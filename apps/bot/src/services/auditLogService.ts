import { randomUUID } from 'crypto';
import { db } from '../database/db.js';
import { AuditLogRecord } from '@sciclub/shared';
import { logger } from '../utils/logger.js';

export class AuditLogService {
  static async record(entry: {
    guildId: string;
    userId: string;
    username: string;
    action: string;
    targetType: 'role' | 'channel' | 'permission' | 'member' | 'project' | 'event' | 'resource' | 'config';
    targetId?: string | null;
    details: string;
  }): Promise<void> {
    try {
      const id = randomUUID();
      const stmt = db.prepare(`
        INSERT INTO audit_logs (id, guild_id, user_id, username, action, target_type, target_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      await stmt.run(
        id,
        entry.guildId,
        entry.userId,
        entry.username,
        entry.action,
        entry.targetType,
        entry.targetId || null,
        entry.details
      );
      logger.info({ action: entry.action, user: entry.username, guild: entry.guildId }, '📝 Audit log enregistré');
    } catch (error) {
      logger.error({ error, entry }, 'Erreur lors de l\'enregistrement de l\'audit log');
    }
  }

  static async getRecentLogs(guildId: string, limit: number = 50): Promise<AuditLogRecord[]> {
    const stmt = db.prepare(`
      SELECT 
        id,
        guild_id as guildId,
        user_id as userId,
        username,
        action,
        target_type as targetType,
        target_id as targetId,
        details,
        created_at as createdAt
      FROM audit_logs
      WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return (await stmt.all(guildId, limit)) as unknown as AuditLogRecord[];
  }
}
