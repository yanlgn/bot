import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { validateBody } from '../middleware/validate.js';
import { discordClient } from '../botClient.js';
import { CreateEventSchema, UpdateEventSchema, hexToDecimalColor } from '@sciclub/shared';
import { PermissionFlagsBits, TextChannel } from 'discord.js';
import { db } from '../db.js';
import {
  buildEventMessagePayload,
  syncEventDiscordMessage
} from '../utils/eventDiscordHelper.js';

export const eventsRouter = Router({ mergeParams: true });

/**
 * GET /api/guilds/:guildId/events
 * Récupère la liste des événements avec leurs sessions et compteurs
 */
eventsRouter.get('/', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  try {
    const events = (await db.prepare(`
      SELECT 
        e.id,
        e.guild_id as "guildId",
        e.title,
        e.description,
        e.type,
        e.scheduled_start_time as "scheduledStartTime",
        e.end_time as "endTime",
        e.location,
        e.speaker,
        e.max_participants as "maxParticipants",
        e.target_audience as "targetAudience",
        e.is_recurring as "isRecurring",
        e.recurrence_pattern as "recurrencePattern",
        e.allow_cancellation as "allowCancellation",
        e.status,
        e.channel_id as "channelId",
        e.discord_message_id as "discordMessageId",
        e.participant_role_id as "participantRoleId",
        (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status = 'registered') as "participantCount",
        e.created_at as "createdAt",
        e.updated_at as "updatedAt"
      FROM events e
      WHERE e.guild_id = ?
      ORDER BY e.scheduled_start_time DESC
    `).all(guildId)) as any[];

    const guild = discordClient.guilds.cache.get(guildId);

    // Récupérer les sessions pour chaque événement
    const enrichedEvents = await Promise.all(events.map(async (ev) => {
      let channelName = null;
      if (guild && ev.channelId) {
        channelName = guild.channels.cache.get(ev.channelId)?.name || null;
      }

      const sessions = (await db.prepare(`
        SELECT 
          s.id,
          s.event_id as "eventId",
          s.guild_id as "guildId",
          s.name,
          s.description,
          s.scheduled_start_time as "scheduledStartTime",
          s.scheduled_end_time as "scheduledEndTime",
          s.max_participants as "maxParticipants",
          (SELECT COUNT(*) FROM event_participants ep WHERE ep.session_id = s.id AND ep.status = 'registered') as "participantCount",
          s.created_at as "createdAt"
        FROM event_sessions s
        WHERE s.event_id = ?
        ORDER BY s.scheduled_start_time ASC, s.created_at ASC
      `).all(ev.id)) as any[];

      return {
        ...ev,
        channelName,
        isRecurring: Boolean(ev.isRecurring),
        allowCancellation: ev.allowCancellation !== false && ev.allowCancellation !== 0,
        sessions
      };
    }));

    res.json({ success: true, data: enrichedEvents });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/events
 * Création d'un événement avec sessions personnalisées et publication Discord
 */
eventsRouter.post('/', requireAuth, requireGuildAdmin, validateBody(CreateEventSchema), async (req: Request, res: Response) => {
  const { guildId } = req.params;
  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const eventId = `ev_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  let participantRoleId: string | null = null;

  if (req.body.createParticipantRole) {
    try {
      const botMember = await guild.members.fetchMe();
      if (botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        const role = await guild.roles.create({
          name: `Participant: ${req.body.title.slice(0, 30)}`,
          color: hexToDecimalColor('#E5092E'),
          mentionable: true,
          reason: `Événement ${req.body.title}`
        });
        participantRoleId = role.id;
      }
    } catch {}
  }

  try {
    await db.prepare(`
      INSERT INTO events (
        id, guild_id, title, description, type, scheduled_start_time, end_time,
        location, speaker, max_participants, target_audience,
        is_recurring, recurrence_pattern, allow_cancellation,
        status, channel_id, participant_role_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, datetime('now'), datetime('now'))
    `).run(
      eventId,
      guild.id,
      req.body.title,
      req.body.description,
      req.body.type,
      req.body.scheduledStartTime,
      req.body.endTime || null,
      req.body.location,
      req.body.speaker || null,
      req.body.maxParticipants || null,
      req.body.targetAudience || null,
      req.body.isRecurring ? true : false,
      req.body.recurrencePattern || null,
      req.body.allowCancellation !== undefined ? req.body.allowCancellation : true,
      req.body.channelId || null,
      participantRoleId
    );

    // Insérer les sessions si fournies (ex: 2 sessions Speaking Circle)
    if (req.body.sessions && Array.isArray(req.body.sessions)) {
      for (const sess of req.body.sessions) {
        const sessionId = sess.id || `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        await db.prepare(`
          INSERT INTO event_sessions (
            id, event_id, guild_id, name, description, scheduled_start_time, scheduled_end_time, max_participants, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          sessionId,
          eventId,
          guild.id,
          sess.name,
          sess.description || null,
          sess.scheduledStartTime || null,
          sess.scheduledEndTime || null,
          sess.maxParticipants || 0
        );
      }
    }

    // Publier immédiatement le message d'inscription interactif dans le salon choisi
    let sentMessageId: string | null = null;
    if (req.body.channelId) {
      try {
        const channel = await guild.channels.fetch(req.body.channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const payload = await buildEventMessagePayload(guild.id, eventId);
          if (payload) {
            const sent = await (channel as TextChannel).send({
              embeds: [payload.embed],
              components: payload.components
            });
            sentMessageId = sent.id;
            await db.prepare('UPDATE events SET discord_message_id = ? WHERE id = ?').run(sent.id, eventId);
          }
        }
      } catch (err) {
        console.error('Erreur lors de l\'envoi Discord de l\'événement:', err);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: eventId,
        title: req.body.title,
        messageId: sentMessageId
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/guilds/:guildId/events/:eventId
 * Mise à jour complète de l'événement et resynchronisation Discord en direct
 */
eventsRouter.put('/:eventId', requireAuth, requireGuildAdmin, validateBody(UpdateEventSchema), async (req: Request, res: Response) => {
  const { guildId, eventId } = req.params;
  const event = (await db.prepare('SELECT * FROM events WHERE id = ? AND guild_id = ?').get(eventId, guildId)) as any;
  if (!event) return res.status(404).json({ success: false, error: 'Événement introuvable.' });

  try {
    const updates: string[] = [];
    const params: any[] = [];

    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      type: 'type',
      scheduledStartTime: 'scheduled_start_time',
      endTime: 'end_time',
      location: 'location',
      speaker: 'speaker',
      maxParticipants: 'max_participants',
      targetAudience: 'target_audience',
      isRecurring: 'is_recurring',
      recurrencePattern: 'recurrence_pattern',
      allowCancellation: 'allow_cancellation',
      status: 'status',
      channelId: 'channel_id'
    };

    for (const [key, dbCol] of Object.entries(fieldMap)) {
      if ((req.body as any)[key] !== undefined) {
        updates.push(`${dbCol} = ?`);
        params.push((req.body as any)[key]);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(eventId);
      await db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    // Mise à jour des sessions si spécifiées
    if (req.body.sessions && Array.isArray(req.body.sessions)) {
      // Supprimer anciennes sessions qui ne sont plus dans la liste
      const sessionIds = req.body.sessions.map((s: any) => s.id).filter(Boolean);
      if (sessionIds.length > 0) {
        const placeholders = sessionIds.map(() => '?').join(',');
        await db.prepare(`DELETE FROM event_sessions WHERE event_id = ? AND id NOT IN (${placeholders})`).run(eventId, ...sessionIds);
      } else {
        await db.prepare('DELETE FROM event_sessions WHERE event_id = ?').run(eventId);
      }

      for (const sess of req.body.sessions) {
        if (sess.id) {
          await db.prepare(`
            UPDATE event_sessions
            SET name = ?, description = ?, scheduled_start_time = ?, scheduled_end_time = ?, max_participants = ?
            WHERE id = ? AND event_id = ?
          `).run(sess.name, sess.description || null, sess.scheduledStartTime || null, sess.scheduledEndTime || null, sess.maxParticipants || 0, sess.id, eventId);
        } else {
          const newSessId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
          await db.prepare(`
            INSERT INTO event_sessions (id, event_id, guild_id, name, description, scheduled_start_time, scheduled_end_time, max_participants, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(newSessId, eventId, guildId, sess.name, sess.description || null, sess.scheduledStartTime || null, sess.scheduledEndTime || null, sess.maxParticipants || 0);
        }
      }
    }

    // Actualiser en direct le message Discord !
    await syncEventDiscordMessage(guildId, eventId);

    res.json({ success: true, message: 'Événement et sessions mis à jour avec succès et synchronisés sur Discord !' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/guilds/:guildId/events/:eventId/participants
 * Liste détaillée des inscrits (Nom, Prénom, Email, Session) pour le staff
 */
eventsRouter.get('/:eventId/participants', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId, eventId } = req.params;
  try {
    const participants = (await db.prepare(`
      SELECT 
        ep.id,
        ep.event_id as "eventId",
        ep.session_id as "sessionId",
        s.name as "sessionName",
        ep.user_id as "userId",
        ep.first_name as "firstName",
        ep.last_name as "lastName",
        ep.email,
        ep.notes,
        ep.status,
        ep.registered_at as "registeredAt",
        u.username,
        u.avatar
      FROM event_participants ep
      LEFT JOIN event_sessions s ON s.id = ep.session_id
      LEFT JOIN users u ON u.id = ep.user_id
      WHERE ep.event_id = ?
      ORDER BY ep.registered_at DESC
    `).all(eventId)) as any[];

    const guild = discordClient.guilds.cache.get(guildId);
    const enriched = participants.map(p => {
      let displayName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.username || p.userId;
      let avatarUrl = p.avatar ? `https://cdn.discordapp.com/avatars/${p.userId}/${p.avatar}.png` : null;

      if (guild) {
        const mem = guild.members.cache.get(p.userId);
        if (mem) {
          avatarUrl = mem.user.displayAvatarURL();
        }
      }

      return {
        ...p,
        displayName,
        avatarUrl
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/guilds/:guildId/events/:eventId/participants/:participantId
 * Désinscrit un membre manuellement (Staff) et libère la place immédiatement
 */
eventsRouter.delete('/:eventId/participants/:participantId', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId, eventId, participantId } = req.params;
  try {
    const participant = (await db.prepare('SELECT * FROM event_participants WHERE id = ? AND event_id = ?').get(participantId, eventId)) as any;
    if (!participant) return res.status(404).json({ success: false, error: 'Participant introuvable.' });

    await db.prepare('DELETE FROM event_participants WHERE id = ?').run(participantId);

    // Retirer le rôle participant si configuré
    const event = (await db.prepare('SELECT * FROM events WHERE id = ?').get(eventId)) as any;
    if (event?.participant_role_id) {
      const guild = discordClient.guilds.cache.get(guildId);
      if (guild) {
        const mem = await guild.members.fetch(participant.user_id).catch(() => null);
        if (mem) await mem.roles.remove(event.participant_role_id).catch(() => null);
      }
    }

    // Synchroniser le message Discord pour libérer la place
    await syncEventDiscordMessage(guildId, eventId);

    res.json({ success: true, message: 'Participant retiré et place libérée avec succès.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/events/:eventId/resend-panel
 * Déploie ou redéploie le message interactif dans le salon spécifié
 */
eventsRouter.post('/:eventId/resend-panel', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId, eventId } = req.params;
  const { channelId } = req.body;

  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return res.status(400).json({ success: false, error: 'Salon textuel invalide.' });
  }

  const payload = await buildEventMessagePayload(guildId, eventId);
  if (!payload) return res.status(404).json({ success: false, error: 'Événement introuvable.' });

  const msg = await (channel as TextChannel).send({
    embeds: [payload.embed],
    components: payload.components
  });

  await db.prepare('UPDATE events SET channel_id = ?, discord_message_id = ? WHERE id = ?').run(channelId, msg.id, eventId);

  res.json({
    success: true,
    message: `Message interactif de l'événement envoyé avec succès dans #${channel.name} !`,
    data: { messageId: msg.id, channelId }
  });
});

/**
 * DELETE /api/guilds/:guildId/events/:eventId
 * Supprime un événement et nettoie son message Discord
 */
eventsRouter.delete('/:eventId', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId, eventId } = req.params;
  try {
    const event = (await db.prepare('SELECT * FROM events WHERE id = ? AND guild_id = ?').get(eventId, guildId)) as any;
    if (!event) return res.status(404).json({ success: false, error: 'Événement introuvable.' });

    // Supprimer le message Discord si existant
    if (event.channel_id && event.discord_message_id) {
      try {
        const guild = discordClient.guilds.cache.get(guildId);
        if (guild) {
          const ch = await guild.channels.fetch(event.channel_id).catch(() => null);
          if (ch && ch.isTextBased()) {
            const msg = await (ch as TextChannel).messages.fetch(event.discord_message_id).catch(() => null);
            if (msg) await msg.delete().catch(() => null);
          }
        }
      } catch {}
    }

    await db.prepare('DELETE FROM event_participants WHERE event_id = ?').run(eventId);
    await db.prepare('DELETE FROM event_sessions WHERE event_id = ?').run(eventId);
    await db.prepare('DELETE FROM events WHERE id = ?').run(eventId);

    res.json({ success: true, message: 'Événement supprimé avec succès.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
