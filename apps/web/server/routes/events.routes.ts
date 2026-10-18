import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { validateBody } from '../middleware/validate.js';
import { discordClient } from '../botClient.js';
import { CreateEventSchema, UpdateEventSchema, hexToDecimalColor } from '@sciclub/shared';
import { PermissionFlagsBits } from 'discord.js';
import { db } from '../db.js';
import { randomUUID } from 'crypto';

export const eventsRouter = Router({ mergeParams: true });

eventsRouter.get('/', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const events = await db.prepare(`
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
  `).all(req.params.guildId);

  res.json({ success: true, data: events });
});

eventsRouter.post('/', requireAuth, requireGuildAdmin, validateBody(CreateEventSchema), async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const eventId = randomUUID();
  let participantRoleId: string | null = null;

  if (req.body.createParticipantRole) {
    try {
      const botMember = await guild.members.fetchMe();
      if (botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        const role = await guild.roles.create({
          name: `Participant: ${req.body.title.slice(0, 30)}`,
          color: hexToDecimalColor('#3B82F6'),
          mentionable: true,
          reason: `Événement ${req.body.title}`
        });
        participantRoleId = role.id;
      }
    } catch {}
  }

  await db.prepare(`
    INSERT INTO events (
      id, guild_id, title, description, type, scheduled_start_time,
      location, speaker, max_participants, target_audience,
      status, channel_id, participant_role_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, datetime('now'), datetime('now'))
  `).run(
    eventId,
    guild.id,
    req.body.title,
    req.body.description,
    req.body.type,
    req.body.scheduledStartTime,
    req.body.location,
    req.body.speaker || null,
    req.body.maxParticipants || null,
    req.body.targetAudience || null,
    req.body.channelId || null,
    participantRoleId
  );

  res.status(201).json({ success: true, data: { id: eventId, title: req.body.title } });
});

eventsRouter.patch('/:eventId', requireAuth, requireGuildAdmin, validateBody(UpdateEventSchema), async (req: Request, res: Response) => {
  const event = await db.prepare('SELECT * FROM events WHERE id = ? AND guild_id = ?').get(req.params.eventId, req.params.guildId);
  if (!event) return res.status(404).json({ success: false, error: 'Événement introuvable.' });

  const updates: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (value !== undefined) {
      const sqlKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      updates.push(`${sqlKey} = ?`);
      params.push(value);
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(req.params.eventId);
    await db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json({ success: true, message: 'Événement mis à jour avec succès.' });
});
