import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { GuildConfigFileSchema, hexToDecimalColor, sanitizeChannelName } from '@sciclub/shared';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { discordClient } from '../botClient.js';
import { ChannelType, PermissionFlagsBits, PermissionsBitField } from 'discord.js';

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
 * POST /api/guilds/:guildId/config/apply
 * Synchronise les catégories, rôles, salons et départements déclarés vers le serveur Discord
 */
configRouter.post('/apply', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) {
    return res.status(404).json({ success: false, error: 'Serveur Discord introuvable ou le bot n\'y est pas connecté.' });
  }

  const { filepath } = getConfigPaths(req.params.guildId);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ success: false, error: 'Fichier de configuration inexistant pour ce serveur.' });
  }

  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    const json = JSON.parse(raw);
    const parsed = GuildConfigFileSchema.parse(json);

    const logs: string[] = [];
    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return res.status(403).json({ success: false, error: 'Le bot ne possède pas les permissions Discord "Gérer les salons" et "Gérer les rôles".' });
    }

    // 1. Sync Catégories déclarées
    const existingChannels = await guild.channels.fetch();
    const existingCategories = existingChannels.filter(c => c && c.type === ChannelType.GuildCategory);
    const categoryKeyToId = new Map<string, string>();

    for (const cat of parsed.categories) {
      let found = existingCategories.find(c => c && c.name.toLowerCase() === cat.name.toLowerCase());
      if (!found) {
        found = await guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          reason: 'Cortex Config Apply : Catégorie déclarée'
        });
        logs.push(`📁 Catégorie créée : "${cat.name}"`);
      }
      categoryKeyToId.set(cat.key, found.id);
    }

    // 2. Sync Rôles déclarés
    const existingRoles = await guild.roles.fetch();
    const roleKeyToId = new Map<string, string>();

    for (const [key, roleDef] of Object.entries(parsed.roles)) {
      let found = existingRoles.find(r => r.name.toLowerCase() === roleDef.name.toLowerCase());
      if (!found) {
        const bitfield = new PermissionsBitField();
        for (const p of roleDef.permissions) {
          if (p in PermissionFlagsBits) {
            bitfield.add(PermissionFlagsBits[p as keyof typeof PermissionFlagsBits]);
          }
        }
        found = await guild.roles.create({
          name: roleDef.name,
          color: hexToDecimalColor(roleDef.color),
          hoist: true,
          mentionable: true,
          permissions: bitfield,
          reason: 'Cortex Config Apply : Rôle déclaré'
        });
        logs.push(`🏷️ Rôle créé : "${roleDef.name}"`);
      }
      roleKeyToId.set(`role:${key}`, found.id);
    }

    // 3. Sync Salons déclarés
    const currentChannels = await guild.channels.fetch();
    const channelKeyToId = new Map<string, string>();

    for (const [key, chDef] of Object.entries(parsed.channels)) {
      const found = currentChannels.find(c => c && c.name.toLowerCase() === chDef.name.toLowerCase());
      const parentId = chDef.categoryKey ? categoryKeyToId.get(chDef.categoryKey) || null : (chDef.categoryId || null);

      if (!found) {
        let type = ChannelType.GuildText;
        if (chDef.type === 'voice') type = ChannelType.GuildVoice;
        else if (chDef.type === 'category') type = ChannelType.GuildCategory;
        else if (chDef.type === 'forum') type = ChannelType.GuildForum;

        const created = await guild.channels.create({
          name: sanitizeChannelName(chDef.name),
          type,
          parent: parentId || undefined,
          topic: chDef.topic,
          reason: 'Cortex Config Apply : Salon déclaré'
        });
        logs.push(`💬 Salon créé : #${chDef.name}`);
        channelKeyToId.set(key, created.id);
      } else {
        channelKeyToId.set(key, found.id);
      }
    }

    // 4. Sync Départements déclarés
    if (parsed.departments && parsed.departments.length > 0) {
      for (const dept of parsed.departments) {
        let catId = dept.categoryId;
        const catName = dept.categoryName || `${dept.icon || '🔬'} PÔLE ${dept.name.toUpperCase()}`;

        if (!catId) {
          let foundCat = existingCategories.find(c => c && c.name.toLowerCase() === catName.toLowerCase());
          if (!foundCat) {
            foundCat = await guild.channels.create({
              name: catName,
              type: ChannelType.GuildCategory,
              reason: `Cortex Sync : Catégorie pôle ${dept.name}`
            });
            logs.push(`🔬 Catégorie Pôle créée : "${catName}"`);
          }
          catId = foundCat.id;
          dept.categoryId = catId;
        }

        if (!dept.leaderRoleId) {
          const leaderName = `Chef Pôle ${dept.shortName || dept.name}`;
          let foundLeader = existingRoles.find(r => r.name.toLowerCase() === leaderName.toLowerCase());
          if (!foundLeader) {
            foundLeader = await guild.roles.create({
              name: leaderName,
              color: hexToDecimalColor(dept.color || '#E5092E'),
              hoist: true,
              mentionable: true,
              reason: `Cortex Sync : Responsable pôle ${dept.name}`
            });
            logs.push(`🎖️ Rôle Responsable créé : "${leaderName}"`);
          }
          dept.leaderRoleId = foundLeader.id;
        }

        if (!dept.memberRoleId) {
          const memberName = `Membre ${dept.shortName || dept.name}`;
          let foundMember = existingRoles.find(r => r.name.toLowerCase() === memberName.toLowerCase());
          if (!foundMember) {
            foundMember = await guild.roles.create({
              name: memberName,
              color: hexToDecimalColor(dept.color || '#E5092E'),
              hoist: false,
              mentionable: true,
              reason: `Cortex Sync : Membre pôle ${dept.name}`
            });
            logs.push(`👥 Rôle Membre créé : "${memberName}"`);
          }
          dept.memberRoleId = foundMember.id;
        }

        // Salons de département
        if (dept.channels && dept.channels.length > 0) {
          for (const ch of dept.channels) {
            const chName = sanitizeChannelName(ch.name);
            const foundCh = currentChannels.find(c => c && c.name.toLowerCase() === chName.toLowerCase());
            if (!foundCh) {
              const chType = ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
              await guild.channels.create({
                name: chName,
                type: chType,
                parent: catId || undefined,
                topic: ch.topic,
                reason: `Cortex Sync : Salon pôle ${dept.name}`
              });
              logs.push(`💬 Salon créé : #${chName}`);
            }
          }
        }

        // Enregistrer en base SQL
        db.prepare(`
          INSERT INTO departments (id, guild_id, name, short_name, icon, color, description, leader_role_id, member_role_id, category_id, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            short_name = excluded.short_name,
            icon = excluded.icon,
            color = excluded.color,
            description = excluded.description,
            leader_role_id = excluded.leader_role_id,
            member_role_id = excluded.member_role_id,
            category_id = excluded.category_id,
            updated_at = datetime('now')
        `).run(
          dept.id,
          guild.id,
          dept.name,
          dept.shortName || null,
          dept.icon || '🔬',
          dept.color || '#E5092E',
          dept.description || '',
          dept.leaderRoleId || null,
          dept.memberRoleId || null,
          dept.categoryId || null
        );
      }

      fs.writeFileSync(filepath, JSON.stringify(parsed, null, 2), 'utf8');
    }

    res.json({
      success: true,
      message: 'Configuration déclarative appliquée avec succès sur Discord !',
      logs: logs.length > 0 ? logs : ['Tous les salons, catégories et rôles déclarés sont déjà en place.']
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
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
