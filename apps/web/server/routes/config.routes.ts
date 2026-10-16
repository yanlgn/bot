import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { GuildConfigFileSchema } from '@sciclub/shared';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { db } from '../db.js';

export const configRouter = Router({ mergeParams: true });

function getConfigPaths(guildId: string) {
  const configDir = path.resolve(process.cwd(), process.env.CONFIG_PATH || './config/guilds');
  const backupDir = path.resolve(process.cwd(), process.env.BACKUP_PATH || './config/backups', guildId);

  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const filepath = path.join(configDir, `${guildId}.json`);
  return { configDir, backupDir, filepath };
}

/**
 * GET /api/guilds/:guildId/config
 */
configRouter.get('/', requireAuth, requireGuildAdmin, (req: Request, res: Response) => {
  const { filepath } = getConfigPaths(req.params.guildId);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ success: false, error: 'Fichier de configuration inexistant pour ce serveur.' });
  }

  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    const json = JSON.parse(raw);
    res.json({ success: true, data: json });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Erreur de lecture du JSON : ${err.message}` });
  }
});

/**
 * POST /api/guilds/:guildId/config/validate
 */
configRouter.post('/validate', requireAuth, requireGuildAdmin, (req: Request, res: Response) => {
  const parsed = GuildConfigFileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Configuration invalide',
      details: parsed.error.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    });
  }
  res.json({ success: true, message: 'La configuration JSON est valide.' });
});

/**
 * PUT /api/guilds/:guildId/config
 */
configRouter.put('/', requireAuth, requireGuildAdmin, (req: Request, res: Response) => {
  const parsed = GuildConfigFileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Configuration invalide selon le schéma Zod',
      details: parsed.error.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    });
  }

  const { backupDir, filepath } = getConfigPaths(req.params.guildId);
  const user = req.session.user!;
  let backupFilename = '';

  // 1. Sauvegarde automatique de l'ancienne version
  if (fs.existsSync(filepath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupFilename = `${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFilename);
    fs.copyFileSync(filepath, backupPath);

    db.prepare(`
      INSERT INTO backups (id, guild_id, filename, filepath, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(randomUUID(), req.params.guildId, backupFilename, backupPath, user.username);
  }

  // 2. Écriture du nouveau fichier
  fs.writeFileSync(filepath, JSON.stringify(parsed.data, null, 2), 'utf8');

  // 3. Synchronisation base de données SQL
  db.prepare(`
    INSERT INTO guild_configs (guild_id, config_json, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(guild_id) DO UPDATE SET
      config_json = excluded.config_json,
      version = version + 1,
      updated_at = datetime('now')
  `).run(req.params.guildId, JSON.stringify(parsed.data));

  // 4. Audit Log
  db.prepare(`
    INSERT INTO audit_logs (id, guild_id, user_id, username, action, target_type, target_id, details, created_at)
    VALUES (?, ?, ?, ?, 'CONFIG_SAVED', 'config', ?, ?, datetime('now'))
  `).run(randomUUID(), req.params.guildId, user.id, user.username, req.params.guildId, `Config mise à jour. Backup : ${backupFilename || 'Premier enregistrement'}`);

  res.json({
    success: true,
    message: 'Configuration sauvegardée avec succès.',
    data: parsed.data,
    backupCreated: backupFilename
  });
});

/**
 * GET /api/guilds/:guildId/config/backups
 */
configRouter.get('/backups', requireAuth, requireGuildAdmin, (req: Request, res: Response) => {
  const backups = db.prepare(`
    SELECT id, filename, created_at as createdAt, created_by as createdBy
    FROM backups
    WHERE guild_id = ?
    ORDER BY created_at DESC
  `).all(req.params.guildId);

  res.json({ success: true, data: backups });
});

/**
 * POST /api/guilds/:guildId/config/restore
 */
configRouter.post('/restore', requireAuth, requireGuildAdmin, (req: Request, res: Response) => {
  const { backupId } = req.body;
  if (!backupId) return res.status(400).json({ success: false, error: 'backupId requis.' });

  const record = db.prepare('SELECT filepath FROM backups WHERE id = ? AND guild_id = ?')
    .get(backupId, req.params.guildId) as { filepath: string } | undefined;

  if (!record || !fs.existsSync(record.filepath)) {
    return res.status(404).json({ success: false, error: 'Fichier de sauvegarde introuvable.' });
  }

  try {
    const raw = fs.readFileSync(record.filepath, 'utf8');
    const json = JSON.parse(raw);
    const validated = GuildConfigFileSchema.parse(json);

    const { filepath } = getConfigPaths(req.params.guildId);
    fs.writeFileSync(filepath, JSON.stringify(validated, null, 2), 'utf8');

    const user = req.session.user!;
    db.prepare(`
      INSERT INTO audit_logs (id, guild_id, user_id, username, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, 'CONFIG_RESTORED', 'config', ?, ?, datetime('now'))
    `).run(randomUUID(), req.params.guildId, user.id, user.username, backupId, `Restauration depuis la sauvegarde ${backupId}`);

    res.json({ success: true, message: 'Configuration restaurée avec succès.', data: validated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/guilds/:guildId/audit-logs
 */
configRouter.get('/audit-logs', requireAuth, requireGuildAdmin, (req: Request, res: Response) => {
  const logs = db.prepare(`
    SELECT id, user_id as userId, username, action, target_type as targetType, target_id as targetId, details, created_at as createdAt
    FROM audit_logs
    WHERE guild_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(req.params.guildId);

  res.json({ success: true, data: logs });
});
