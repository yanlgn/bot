import { randomUUID } from 'crypto';
import { Guild, EmbedBuilder, TextChannel } from 'discord.js';
import { WarningRecord } from '@sciclub/shared';
import { db } from '../database/db.js';
import { AuditLogService } from './auditLogService.js';
import { ConfigService } from './configService.js';
import { logger } from '../utils/logger.js';

export class ModerationService {
  /**
   * Avertit un membre, enregistre l'avertissement et applique un mute automatique si le seuil maxWarnings est atteint
   */
  static async warnMember(
    guild: Guild,
    userId: string,
    reason: string,
    moderator: { id: string; username: string }
  ): Promise<{ warningCount: number; autoMuted: boolean }> {
    const warningId = randomUUID();

    // Insertion du warning
    db.prepare(`
      INSERT INTO warnings (id, guild_id, user_id, moderator_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(warningId, guild.id, userId, moderator.id, reason);

    // Compte total des avertissements actifs
    const countRow = db.prepare('SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ?')
      .get(guild.id, userId) as { count: number };
    const warningCount = countRow.count;

    const config = ConfigService.getGuildConfig(guild.id);
    const maxWarnings = config?.moderation?.maxWarnings ?? 3;
    const autoMuteMinutes = config?.moderation?.autoMuteDurationMinutes ?? 60;
    let autoMuted = false;

    // Si le seuil est atteint, appliquer un timeout automatique
    if (warningCount >= maxWarnings) {
      try {
        const member = await guild.members.fetch(userId);
        if (member.moderatable) {
          await member.timeout(
            autoMuteMinutes * 60 * 1000,
            `Seuil de ${maxWarnings} avertissements atteint (${reason})`
          );
          autoMuted = true;

          // Enregistrer la sanction
          db.prepare(`
            INSERT INTO sanctions (id, guild_id, user_id, moderator_id, type, reason, duration_minutes, created_at)
            VALUES (?, ?, ?, ?, 'mute', ?, ?, datetime('now'))
          `).run(
            randomUUID(),
            guild.id,
            userId,
            'SYSTEM',
            `Auto-mute suite à ${warningCount} avertissements`,
            autoMuteMinutes
          );
        }
      } catch (err) {
        logger.error({ err, userId }, 'Impossible d\'appliquer le timeout automatique');
      }
    }

    // Publication dans le salon des logs de modération
    try {
      const logChannelKey = config?.moderation?.logChannelKey;
      if (logChannelKey && config?.channels?.[logChannelKey]) {
        const chName = config.channels[logChannelKey].name;
        const channel = guild.channels.cache.find(c => c.name === chName && c.isTextBased()) as TextChannel | undefined;

        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('⚠️ Avertissement Modération')
            .setColor(autoMuted ? 0xEF4444 : 0xF59E0B)
            .addFields(
              { name: 'Membre', value: `<@${userId}> (${userId})`, inline: true },
              { name: 'Modérateur', value: moderator.username, inline: true },
              { name: 'Total Avertissements', value: `${warningCount} / ${maxWarnings}`, inline: true },
              { name: 'Raison', value: reason },
              { name: 'Sanction automatique', value: autoMuted ? `Mute temporaire (${autoMuteMinutes} min)` : 'Aucune' }
            )
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      }
    } catch {
      // Ignorer l'erreur d'envoi du message si le salon n'est pas accessible
    }

    AuditLogService.record({
      guildId: guild.id,
      userId: moderator.id,
      username: moderator.username,
      action: 'MEMBER_WARNED',
      targetType: 'member',
      targetId: userId,
      details: `Avertissement accordé à ${userId}. Total: ${warningCount}. Raison : ${reason}`
    });

    return { warningCount, autoMuted };
  }

  /**
   * Retourne l'historique des avertissements d'un membre ou du serveur
   */
  static getWarnings(guildId: string, userId?: string): WarningRecord[] {
    if (userId) {
      return db.prepare(`
        SELECT id, guild_id as guildId, user_id as userId, moderator_id as moderatorId, reason, created_at as createdAt
        FROM warnings
        WHERE guild_id = ? AND user_id = ?
        ORDER BY created_at DESC
      `).all(guildId, userId) as unknown as WarningRecord[];
    }

    return db.prepare(`
      SELECT id, guild_id as guildId, user_id as userId, moderator_id as moderatorId, reason, created_at as createdAt
      FROM warnings
      WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(guildId) as unknown as WarningRecord[];
  }
}
