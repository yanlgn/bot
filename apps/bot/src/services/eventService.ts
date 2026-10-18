import { randomUUID } from 'crypto';
import { Guild, EmbedBuilder, TextChannel } from 'discord.js';
import { CreateEventInput, EventRecord, hexToDecimalColor } from '@sciclub/shared';
import { db } from '../database/db.js';
import { AuditLogService } from './auditLogService.js';
import { PointsService } from './pointsService.js';
import { ConfigService } from './configService.js';
import { PermissionFlagsBits } from 'discord.js';

export class EventService {
  /**
   * Crée un événement scientifique avec rôle participant automatique
   */
  static async createEvent(
    guild: Guild,
    input: CreateEventInput,
    operator: { id: string; username: string }
  ): Promise<EventRecord> {
    const eventId = randomUUID();
    let participantRoleId: string | null = null;

    // Création facultative d'un rôle Discord dédié aux participants de l'événement
    if (input.createParticipantRole) {
      try {
        const botMember = await guild.members.fetchMe();
        if (botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
          const role = await guild.roles.create({
            name: `Participant: ${input.title.slice(0, 30)}`,
            color: hexToDecimalColor('#3B82F6'),
            mentionable: true,
            reason: `Rôle participant automatique pour l'événement ${input.title}`
          });
          participantRoleId = role.id;
        }
      } catch {
        // En cas d'échec du rôle, continuer la création
      }
    }

    const insertEvent = db.prepare(`
      INSERT INTO events (
        id, guild_id, title, description, type, scheduled_start_time,
        location, speaker, max_participants, target_audience,
        status, channel_id, participant_role_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, datetime('now'), datetime('now'))
    `);

    await insertEvent.run(
      eventId,
      guild.id,
      input.title,
      input.description,
      input.type,
      input.scheduledStartTime,
      input.location,
      input.speaker || null,
      input.maxParticipants || null,
      input.targetAudience || null,
      input.channelId || null,
      participantRoleId
    );

    // Publication d'un message d'annonce si un salon est spécifié ou configuré
    try {
      const config = ConfigService.getGuildConfig(guild.id);
      let targetChannelId = input.channelId;

      if (!targetChannelId && config?.channels?.events) {
        const eventChannelName = config.channels.events.name;
        const ch = guild.channels.cache.find(c => c.name === eventChannelName && c.isTextBased());
        if (ch) targetChannelId = ch.id;
      }

      if (targetChannelId) {
        const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle(`🔬 Nouvel Événement : ${input.title}`)
            .setDescription(input.description)
            .setColor(0x3B82F6)
            .addFields(
              { name: '📌 Type', value: input.type.toUpperCase(), inline: true },
              { name: '📍 Lieu', value: input.location, inline: true },
              { name: '⏰ Date', value: new Date(input.scheduledStartTime).toLocaleString('fr-FR'), inline: true },
              { name: '🎙️ Intervenant', value: input.speaker || 'Non spécifié', inline: true },
              { name: '👥 Places', value: input.maxParticipants ? `${input.maxParticipants} max` : 'Illimité', inline: true }
            )
            .setFooter({ text: 'Inscrivez-vous via SciClub Manager ou avec /evenement inscrire' });

          await (channel as TextChannel).send({ embeds: [embed] });
        }
      }
    } catch {
      // Ignorer l'erreur d'envoi du message si permissions manquantes
    }

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'EVENT_CREATED',
      targetType: 'event',
      targetId: eventId,
      details: `Événement "${input.title}" (${input.type}) programmé pour le ${input.scheduledStartTime}`
    });

    return {
      id: eventId,
      guildId: guild.id,
      title: input.title,
      description: input.description,
      type: input.type,
      scheduledStartTime: input.scheduledStartTime,
      location: input.location,
      speaker: input.speaker || null,
      maxParticipants: input.maxParticipants || null,
      targetAudience: input.targetAudience || null,
      status: 'published',
      channelId: input.channelId || null,
      participantRoleId,
      participantCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Inscription d'un membre à un événement avec attribution automatique du rôle
   */
  static async registerParticipant(guild: Guild, eventId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const event = (await db.prepare('SELECT * FROM events WHERE id = ? AND guild_id = ?').get(eventId, guild.id)) as any;
    if (!event) throw new Error('Événement introuvable.');

    if (event.status !== 'published') {
      throw new Error('Cet événement n\'est plus ouvert aux inscriptions.');
    }

    const countRow = (await db.prepare('SELECT COUNT(*) as count FROM event_participants WHERE event_id = ?').get(eventId)) as { count: number };
    if (event.max_participants && countRow.count >= event.max_participants) {
      throw new Error('Désolé, le nombre maximum de participants pour cet événement est atteint.');
    }

    try {
      await db.prepare('INSERT INTO event_participants (event_id, user_id, registered_at) VALUES (?, ?, datetime(\'now\'))')
        .run(eventId, userId);
    } catch {
      throw new Error('Vous êtes déjà inscrit à cet événement.');
    }

    // Attribution du rôle participant si existant
    if (event.participant_role_id) {
      try {
        const member = await guild.members.fetch(userId);
        await member.roles.add(event.participant_role_id, 'Inscription à l\'événement');
      } catch {
        // En cas d'erreur de rôle
      }
    }

    // Attribution de points pour participation
    const config = ConfigService.getGuildConfig(guild.id);
    const pts = config?.points?.eventParticipationPoints ?? 10;
    if (config?.points?.enabled) {
      await PointsService.addPoints(guild.id, userId, pts);
    }

    return { success: true, message: 'Inscription confirmée avec succès !' };
  }

  /**
   * Retourne la liste des événements
   */
  static async getEvents(guildId: string): Promise<EventRecord[]> {
    const events = (await db.prepare(`
      SELECT 
        e.id,
        e.guild_id as guildId,
        e.title,
        e.description,
        e.type,
        e.scheduled_start_time as scheduledStartTime,
        e.location,
        e.speaker,
        e.max_participants as maxParticipants,
        e.target_audience as targetAudience,
        e.status,
        e.channel_id as channelId,
        e.participant_role_id as participantRoleId,
        COUNT(ep.user_id) as participantCount,
        e.created_at as createdAt,
        e.updated_at as updatedAt
      FROM events e
      LEFT JOIN event_participants ep ON e.id = ep.event_id
      WHERE e.guild_id = ?
      GROUP BY e.id
      ORDER BY e.scheduled_start_time ASC
    `).all(guildId)) as unknown as EventRecord[];

    return events;
  }
}
