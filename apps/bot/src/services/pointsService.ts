import { db } from '../database/db.js';
import { logger } from '../utils/logger.js';

export interface LeaderboardEntry {
  userId: string;
  balance: number;
}

export class PointsService {
  /**
   * Ajoute des points à un membre
   */
  static async addPoints(guildId: string, userId: string, amount: number): Promise<number> {
    if (amount <= 0) return this.getBalance(guildId, userId);

    try {
      const stmt = db.prepare(`
        INSERT INTO points (guild_id, user_id, balance, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(guild_id, user_id) DO UPDATE SET
          balance = points.balance + excluded.balance,
          updated_at = datetime('now')
        RETURNING balance
      `);
      const row = (await stmt.get(guildId, userId, amount)) as unknown as { balance: number };
      return row ? row.balance : 0;
    } catch (error) {
      logger.error({ error, guildId, userId }, 'Erreur lors de l\'ajout de points');
      return 0;
    }
  }

  /**
   * Obtient le solde de points d'un membre
   */
  static async getBalance(guildId: string, userId: string): Promise<number> {
    const row = (await db.prepare('SELECT balance FROM points WHERE guild_id = ? AND user_id = ?')
      .get(guildId, userId)) as unknown as { balance: number } | undefined;
    return row ? row.balance : 0;
  }

  /**
   * Retourne le classement du club par points
   */
  static async getLeaderboard(guildId: string, limit: number = 20): Promise<LeaderboardEntry[]> {
    const rows = (await db.prepare(`
      SELECT user_id as userId, balance
      FROM points
      WHERE guild_id = ?
      ORDER BY balance DESC
      LIMIT ?
    `).all(guildId, limit)) as unknown as LeaderboardEntry[];
    return rows;
  }
}
