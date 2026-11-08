import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { discordClient } from '../botClient.js';
import { db } from '../db.js';
import { EmbedBuilder } from 'discord.js';

export const messagesRouter = Router({ mergeParams: true });

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hexToIntColor(hex: string): number {
  const clean = hex.replace('#', '');
  return parseInt(clean, 16) || 0xE5092E;
}

/**
 * GET /api/guilds/:guildId/messages/history
 * Liste l'historique des campagnes de messages privés envoyés
 */
messagesRouter.get('/history', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  try {
    const campaigns = (await db.prepare(`
      SELECT 
        id,
        guild_id as "guildId",
        sender_id as "senderId",
        sender_name as "senderName",
        target_type as "targetType",
        target_name as "targetName",
        title,
        message,
        total_targets as "totalTargets",
        sent_count as "sentCount",
        failed_count as "failedCount",
        created_at as "createdAt"
      FROM dm_campaigns
      WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(guildId)) as any[];

    res.json({ success: true, data: campaigns });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/guilds/:guildId/messages/targets-count
 * Calcule en temps réel le nombre de destinataires selon le ciblage
 */
messagesRouter.get('/targets-count', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  const { targetType, targetId, sessionId } = req.query as { targetType: string; targetId?: string; sessionId?: string };

  try {
    let count = 0;
    const preview: string[] = [];

    if (targetType === 'event' && targetId) {
      let query = `
        SELECT ep.first_name, ep.last_name, ep.user_id 
        FROM event_participants ep 
        WHERE ep.guild_id = ? AND ep.event_id = ? AND ep.status = 'registered'
      `;
      const params: any[] = [guildId, targetId];
      if (sessionId && sessionId !== 'all') {
        query += ` AND ep.session_id = ?`;
        params.push(sessionId);
      }
      const rows = (await db.prepare(query).all(...params)) as any[];
      count = rows.length;
      preview.push(...rows.slice(0, 5).map(r => `${r.first_name} ${r.last_name}`));
    } else if (targetType === 'department' && targetId) {
      const rows = (await db.prepare(`
        SELECT dm.first_name, dm.last_name, dm.user_id 
        FROM department_members dm 
        WHERE dm.guild_id = ? AND dm.department_id = ? AND dm.status = 'approved'
      `).all(guildId, targetId)) as any[];
      count = rows.length;
      preview.push(...rows.slice(0, 5).map(r => `${r.first_name} ${r.last_name}`));
    } else if (targetType === 'role' && targetId) {
      const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        await guild.members.fetch();
        const role = guild.roles.cache.get(targetId);
        if (role) {
          count = role.members.size;
          preview.push(...role.members.first(5).map(m => m.displayName));
        }
      }
    } else if (targetType === 'user' && targetId) {
      count = 1;
      preview.push(targetId);
    }

    res.json({ success: true, data: { count, preview } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/messages/send
 * Envoie une campagne de DM ciblée avec variables dynamiques et throttling anti-rate-limit
 */
messagesRouter.post('/send', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  const user = req.session.user!;
  const {
    targetType,
    targetId,
    sessionId,
    title,
    message,
    color = '#E5092E'
  } = req.body;

  if (!title || !message) {
    return res.status(400).json({ success: false, error: 'Le titre et le message sont requis.' });
  }

  try {
    const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return res.status(404).json({ success: false, error: 'Serveur Discord introuvable.' });
    }

    // Récupérer les destinataires et leurs métadonnées
    interface Recipient {
      userId: string;
      firstName?: string;
      lastName?: string;
      eventTitle?: string;
      sessionName?: string;
      sessionTime?: string;
      location?: string;
    }

    const recipients: Recipient[] = [];
    let targetName = 'Destinataires inconnus';

    if (targetType === 'event') {
      const event = (await db.prepare('SELECT title, location, scheduled_start_time FROM events WHERE id = ? AND guild_id = ?').get(targetId, guildId)) as any;
      if (!event) return res.status(404).json({ success: false, error: 'Événement introuvable.' });

      targetName = `Événement: ${event.title}`;

      let query = `
        SELECT 
          ep.user_id as "userId",
          ep.first_name as "firstName",
          ep.last_name as "lastName",
          s.name as "sessionName",
          s.day_of_week as "dayOfWeek",
          s.start_time as "startTime",
          s.end_time as "endTime"
        FROM event_participants ep
        LEFT JOIN event_sessions s ON ep.session_id = s.id
        WHERE ep.guild_id = ? AND ep.event_id = ? AND ep.status = 'registered'
      `;
      const params: any[] = [guildId, targetId];

      if (sessionId && sessionId !== 'all') {
        query += ` AND ep.session_id = ?`;
        params.push(sessionId);
        const sessionRow = (await db.prepare('SELECT name FROM event_sessions WHERE id = ?').get(sessionId)) as any;
        if (sessionRow) targetName += ` (${sessionRow.name})`;
      }

      const rows = (await db.prepare(query).all(...params)) as any[];
      for (const r of rows) {
        const timeDetail = r.startTime ? (r.endTime ? `${r.startTime} - ${r.endTime}` : r.startTime) : '';
        const sessionTime = r.dayOfWeek && timeDetail ? `${r.dayOfWeek} à ${timeDetail}` : (timeDetail || r.dayOfWeek || '');
        recipients.push({
          userId: r.userId,
          firstName: r.firstName,
          lastName: r.lastName,
          eventTitle: event.title,
          sessionName: r.sessionName || 'Session principale',
          sessionTime,
          location: event.location
        });
      }
    } else if (targetType === 'department') {
      const dept = (await db.prepare('SELECT name, short_name FROM departments WHERE id = ? AND guild_id = ?').get(targetId, guildId)) as any;
      if (!dept) return res.status(404).json({ success: false, error: 'Pôle introuvable.' });

      targetName = `Pôle: ${dept.name}`;
      const rows = (await db.prepare(`
        SELECT user_id as "userId", first_name as "firstName", last_name as "lastName"
        FROM department_members
        WHERE guild_id = ? AND department_id = ? AND status = 'approved'
      `).all(guildId, targetId)) as any[];

      for (const r of rows) {
        recipients.push({
          userId: r.userId,
          firstName: r.firstName,
          lastName: r.lastName
        });
      }
    } else if (targetType === 'role') {
      await guild.members.fetch();
      const role = guild.roles.cache.get(targetId);
      if (!role) return res.status(404).json({ success: false, error: 'Rôle introuvable.' });

      targetName = `Rôle: @${role.name}`;
      for (const m of role.members.values()) {
        if (!m.user.bot) {
          recipients.push({
            userId: m.id,
            firstName: m.displayName
          });
        }
      }
    } else if (targetType === 'user') {
      targetName = `Utilisateur: ${targetId}`;
      recipients.push({ userId: targetId });
    }

    if (recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun destinataire trouvé pour ce ciblage.' });
    }

    // Envoi des messages avec throttling (500ms entre chaque DM)
    let sentCount = 0;
    let failedCount = 0;
    const failedUsers: string[] = [];

    const embedColor = hexToIntColor(color);

    for (const r of recipients) {
      try {
        const discordUser = await discordClient.users.fetch(r.userId).catch(() => null);
        if (!discordUser) {
          failedCount++;
          failedUsers.push(r.userId);
          continue;
        }

        // Remplacement dynamique des variables
        const personalizedTitle = title
          .replace(/{prenom}/gi, r.firstName || discordUser.username)
          .replace(/{nom}/gi, r.lastName || '')
          .replace(/{evenement}/gi, r.eventTitle || '')
          .replace(/{session}/gi, r.sessionName || '')
          .replace(/{lieu}/gi, r.location || '')
          .replace(/{serveur}/gi, guild.name);

        const personalizedBody = message
          .replace(/{prenom}/gi, r.firstName || discordUser.username)
          .replace(/{nom}/gi, r.lastName || '')
          .replace(/{evenement}/gi, r.eventTitle || '')
          .replace(/{session}/gi, r.sessionName ? `${r.sessionName}${r.sessionTime ? ` (${r.sessionTime})` : ''}` : '')
          .replace(/{lieu}/gi, r.location || '')
          .replace(/{serveur}/gi, guild.name);

        const embed = new EmbedBuilder()
          .setTitle(personalizedTitle.slice(0, 256))
          .setDescription(personalizedBody.slice(0, 4096))
          .setColor(embedColor)
          .setFooter({
            text: `${guild.name} • Message officiel envoyé par ${user.username}`,
            iconURL: guild.iconURL() || undefined
          })
          .setTimestamp();

        await discordUser.send({ embeds: [embed] });
        sentCount++;
      } catch (err: any) {
        failedCount++;
        failedUsers.push(r.userId);
      }

      // Attendre 500ms pour préserver les rate-limits Discord
      if (recipients.length > 1) {
        await sleep(500);
      }
    }

    // Enregistrer la campagne dans dm_campaigns
    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      await db.prepare(`
        INSERT INTO dm_campaigns (id, guild_id, sender_id, sender_name, target_type, target_name, title, message, total_targets, sent_count, failed_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        campaignId,
        guildId,
        user.id,
        user.username,
        targetType,
        targetName,
        title,
        message,
        recipients.length,
        sentCount,
        failedCount
      );
    } catch (dbErr) {
      console.error('Erreur enregistrement campagne DM:', dbErr);
    }

    res.json({
      success: true,
      data: {
        totalTargets: recipients.length,
        sentCount,
        failedCount,
        failedUsers
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/guilds/:guildId/messages/events/:eventId/reminder
 * Déclenche l'envoi d'un rappel automatique par DM aux inscrits d'un événement
 */
messagesRouter.post('/events/:eventId/reminder', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId, eventId } = req.params;
  const user = req.session.user!;
  const { sessionId, customMessage } = req.body;

  try {
    const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(404).json({ success: false, error: 'Serveur Discord introuvable.' });

    const event = (await db.prepare('SELECT * FROM events WHERE id = ? AND guild_id = ?').get(eventId, guildId)) as any;
    if (!event) return res.status(404).json({ success: false, error: 'Événement introuvable.' });

    let query = `
      SELECT 
        ep.user_id as "userId",
        ep.first_name as "firstName",
        ep.last_name as "lastName",
        s.name as "sessionName",
        s.day_of_week as "dayOfWeek",
        s.start_time as "startTime",
        s.end_time as "endTime"
      FROM event_participants ep
      LEFT JOIN event_sessions s ON ep.session_id = s.id
      WHERE ep.guild_id = ? AND ep.event_id = ? AND ep.status = 'registered'
    `;
    const params: any[] = [guildId, eventId];

    let sessionNameSuffix = '';
    if (sessionId && sessionId !== 'all') {
      query += ` AND ep.session_id = ?`;
      params.push(sessionId);
      const sessionRow = (await db.prepare('SELECT name FROM event_sessions WHERE id = ?').get(sessionId)) as any;
      if (sessionRow) sessionNameSuffix = ` (${sessionRow.name})`;
    }

    const participants = (await db.prepare(query).all(...params)) as any[];

    if (participants.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun participant inscrit trouvé pour cet événement.' });
    }

    const title = `🔔 Rappel : ${event.title}`;
    let sentCount = 0;
    let failedCount = 0;

    for (const p of participants) {
      try {
        const discordUser = await discordClient.users.fetch(p.userId).catch(() => null);
        if (!discordUser) {
          failedCount++;
          continue;
        }

        const timeDetail = p.startTime ? (p.endTime ? `${p.startTime} - ${p.endTime}` : p.startTime) : '';
        const sessionDetail = p.sessionName
          ? `${p.sessionName}${p.dayOfWeek && timeDetail ? ` — ${p.dayOfWeek} à ${timeDetail}` : (timeDetail ? ` — ${timeDetail}` : '')}`
          : (event.scheduled_start_time ? new Date(event.scheduled_start_time).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' }) : 'Horaire convenu');

        const body = customMessage
          ? customMessage
              .replace(/{prenom}/gi, p.firstName || discordUser.username)
              .replace(/{nom}/gi, p.lastName || '')
              .replace(/{evenement}/gi, event.title)
              .replace(/{session}/gi, sessionDetail)
              .replace(/{lieu}/gi, event.location || 'En ligne')
          : `Bonjour **${p.firstName || discordUser.username}**,\n\nCeci est un rappel amical concernant votre inscription à l'événement **${event.title}** au sein de **${guild.name}** !\n\n📅 **Session / Horaire :** ${sessionDetail}\n📍 **Lieu :** ${event.location || 'En ligne'}\n\n💡 *Si vous avez un empêchement de dernière minute, pensez à libérer votre place pour permettre aux autres membres du club de participer.*`;

        const embed = new EmbedBuilder()
          .setTitle(title.slice(0, 256))
          .setDescription(body)
          .setColor(0xE5092E)
          .setFooter({
            text: `${guild.name} • Rappel officiel`,
            iconURL: guild.iconURL() || undefined
          })
          .setTimestamp();

        await discordUser.send({ embeds: [embed] });
        sentCount++;
      } catch {
        failedCount++;
      }

      if (participants.length > 1) {
        await sleep(500);
      }
    }

    // Enregistrer la campagne
    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      await db.prepare(`
        INSERT INTO dm_campaigns (id, guild_id, sender_id, sender_name, target_type, target_name, title, message, total_targets, sent_count, failed_count)
        VALUES (?, ?, ?, ?, 'event_reminder', ?, ?, ?, ?, ?, ?)
      `).run(
        campaignId,
        guildId,
        user.id,
        user.username,
        `Rappel: ${event.title}${sessionNameSuffix}`,
        title,
        customMessage || 'Rappel automatique envoyé aux participants.',
        participants.length,
        sentCount,
        failedCount
      );
    } catch {}

    res.json({
      success: true,
      data: {
        totalTargets: participants.length,
        sentCount,
        failedCount
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
