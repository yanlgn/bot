import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { GuildConfigFile, GuildConfigFileSchema } from '@sciclub/shared';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { db } from '../database/db.js';
import { AuditLogService } from './auditLogService.js';

export class ConfigService {
  private static getConfigDir(): string {
    const dir = path.resolve(process.cwd(), env.CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private static getBackupDir(guildId: string): string {
    const dir = path.resolve(process.cwd(), env.BACKUP_PATH, guildId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  static getGuildConfigFilepath(guildId: string): string {
    return path.join(this.getConfigDir(), `${guildId}.json`);
  }

  /**
   * Charge et valide la configuration JSON déclarative d'une guilde
   */
  static getGuildConfig(guildId: string): GuildConfigFile | null {
    const filepath = this.getGuildConfigFilepath(guildId);
    if (!fs.existsSync(filepath)) {
      try {
        const row = db.prepare('SELECT config_json FROM guild_configs WHERE guild_id = ?').get(guildId) as any;
        if (row && row.config_json) {
          const parsed = GuildConfigFileSchema.parse(JSON.parse(row.config_json));
          fs.writeFileSync(filepath, JSON.stringify(parsed, null, 2), 'utf8');
          return parsed;
        }
      } catch {}
      return null;
    }

    try {
      const raw = fs.readFileSync(filepath, 'utf8');
      const json = JSON.parse(raw);
      const parsed = GuildConfigFileSchema.parse(json);
      return parsed;
    } catch (error) {
      logger.error({ error, guildId }, `Erreur lors de la lecture ou validation du fichier de config ${filepath}`);
      throw error;
    }
  }

  /**
   * Sauvegarde une configuration avec validation Zod et backup horodaté automatique
   */
  static async saveGuildConfig(
    guildId: string,
    newConfig: unknown,
    operator: { id: string; username: string }
  ): Promise<{ success: boolean; config: GuildConfigFile; backupPath: string }> {
    // 1. Validation stricte avec Zod
    const validated = GuildConfigFileSchema.parse(newConfig);

    // 2. Création d'une sauvegarde de l'ancienne version si elle existe
    const filepath = this.getGuildConfigFilepath(guildId);
    let backupPath = '';

    if (fs.existsSync(filepath)) {
      const backupDir = this.getBackupDir(guildId);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `${timestamp}.json`;
      backupPath = path.join(backupDir, backupFilename);
      fs.copyFileSync(filepath, backupPath);

      // Enregistrer dans la table SQLite backups
      const stmt = db.prepare(`
        INSERT INTO backups (id, guild_id, filename, filepath, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `);
      await stmt.run(randomUUID(), guildId, backupFilename, backupPath, operator.username);
    }

    // 3. Écriture atomique ou formatée
    fs.writeFileSync(filepath, JSON.stringify(validated, null, 2), 'utf8');

    // 4. Synchronisation base de données SQL guild_configs
    const updateStmt = db.prepare(`
      INSERT INTO guild_configs (guild_id, config_json, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(guild_id) DO UPDATE SET
        config_json = excluded.config_json,
        version = version + 1,
        updated_at = datetime('now')
    `);
    await updateStmt.run(guildId, JSON.stringify(validated));

    // 5. Audit Log
    AuditLogService.record({
      guildId,
      userId: operator.id,
      username: operator.username,
      action: 'CONFIG_UPDATED',
      targetType: 'config',
      targetId: guildId,
      details: `Configuration mise à jour. Sauvegarde créée : ${backupPath || 'Aucune (premier enregistrement)'}`
    });

    return {
      success: true,
      config: validated,
      backupPath
    };
  }

  /**
   * Liste les sauvegardes disponibles pour un serveur
   */
  static async listBackups(guildId: string): Promise<Array<{ id: string; filename: string; createdAt: string; createdBy: string }>> {
    const stmt = db.prepare(`
      SELECT id, filename, created_at as createdAt, created_by as createdBy
      FROM backups
      WHERE guild_id = ?
      ORDER BY created_at DESC
    `);
    return (await stmt.all(guildId)) as Array<{ id: string; filename: string; createdAt: string; createdBy: string }>;
  }

  /**
   * Restaure une configuration depuis une sauvegarde
   */
  static async restoreBackup(
    guildId: string,
    backupId: string,
    operator: { id: string; username: string }
  ): Promise<GuildConfigFile> {
    const stmt = db.prepare(`
      SELECT filepath FROM backups WHERE id = ? AND guild_id = ?
    `);
    const record = (await stmt.get(backupId, guildId)) as { filepath: string } | undefined;

    if (!record || !fs.existsSync(record.filepath)) {
      throw new Error(`Fichier de sauvegarde introuvable (ID: ${backupId})`);
    }

    const backupRaw = fs.readFileSync(record.filepath, 'utf8');
    const json = JSON.parse(backupRaw);
    const validated = GuildConfigFileSchema.parse(json);

    // Écrit le fichier principal
    const currentPath = this.getGuildConfigFilepath(guildId);
    fs.writeFileSync(currentPath, JSON.stringify(validated, null, 2), 'utf8');

    AuditLogService.record({
      guildId,
      userId: operator.id,
      username: operator.username,
      action: 'CONFIG_RESTORED',
      targetType: 'config',
      targetId: backupId,
      details: `Restauration de la configuration depuis la sauvegarde ${record.filepath}`
    });

    return validated;
  }
}
