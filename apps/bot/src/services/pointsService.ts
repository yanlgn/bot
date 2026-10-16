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
  static addPoints(guildId: string, userId: string, amount: number): number {
    if (amount <= 0) return this.getBalance(guildId, userId);

    try {
      const stmt = db.prepare(`
        INSERT INTO points (guild_id, user_id, balance, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(guild_id, user_id) DO UPDATE SET
          balance = balance + excluded.balance,
          updated_at = datetime('now')
        RETURNING balance
      `);
      const row = stmt.get(guildId, userId, amount) as unknown as { balance: number };
      return row.balance;
    } catch (error) {
      logger.error({ error, guildId, userId }, 'Erreur lors de l\'ajout de points');
      return 0;
    }
  }

  /**
   * Obtient le solde de points d'un membre
   */
  static getBalance(guildId: string, userId: string): number {
    const row = db.prepare('SELECT balance FROM points WHERE guild_id = ? AND user_id = ?')
      .get(guildId, userId) as unknown as { balance: number } | undefined;
    return row ? row.balance : 0;
  }

  /**
   * Retourne le classement du club par points
   */
  static getLeaderboard(guildId: string, limit: number = 20): LeaderboardEntry[] {
    const rows = db.prepare(`
      SELECT user_id as userId, balance
      FROM points
      WHERE guild_id = ?
      ORDER BY balance DESC
      LIMIT ?
    `).all(guildId, limit) as unknown as LeaderboardEntry[];
    return rows;
  }
}
