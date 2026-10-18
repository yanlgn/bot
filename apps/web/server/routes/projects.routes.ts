import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { validateBody } from '../middleware/validate.js';
import { discordClient } from '../botClient.js';
import { CreateProjectSchema, UpdateProjectSchema, sanitizeChannelName } from '@sciclub/shared';
import { ChannelType, PermissionFlagsBits, TextChannel } from 'discord.js';
import { db } from '../db.js';
import { randomUUID } from 'crypto';

export const projectsRouter = Router({ mergeParams: true });

projectsRouter.get('/', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guildId = req.params.guildId;
  const projects = (await db.prepare(`
    SELECT id, guild_id as guildId, name, description, leader_id as leaderId, channel_id as channelId, status, created_at as createdAt, updated_at as updatedAt
    FROM projects
    WHERE guild_id = ?
    ORDER BY created_at DESC
  `).all(guildId)) as any[];

  const result = await Promise.all(projects.map(async p => {
    const memberRows = (await db.prepare('SELECT user_id FROM project_members WHERE project_id = ?').all(p.id)) as { user_id: string }[];
    return {
      ...p,
      memberIds: memberRows.map(m => m.user_id)
    };
  }));

  res.json({ success: true, data: result });
});

projectsRouter.post('/', requireAuth, requireGuildAdmin, validateBody(CreateProjectSchema), async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const projectId = randomUUID();
  let channelId: string | null = null;

  if (req.body.createChannel) {
    try {
      const botMember = await guild.members.fetchMe();
      if (botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        const channelName = sanitizeChannelName(`prj-${req.body.name}`);
        const ch = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          topic: `🚀 Projet : ${req.body.name}`,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: req.body.leaderId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ]
        });
        channelId = ch.id;
      }
    } catch {}
  }

  await db.prepare(`
    INSERT INTO projects (id, guild_id, name, description, leader_id, channel_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'idea', datetime('now'), datetime('now'))
  `).run(projectId, guild.id, req.body.name, req.body.description, req.body.leaderId, channelId);

  await db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, \'leader\')')
    .run(projectId, req.body.leaderId);

  for (const m of req.body.memberIds) {
    if (m !== req.body.leaderId) {
      await db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, \'contributor\')').run(projectId, m);
    }
  }

  res.status(201).json({ success: true, data: { id: projectId, name: req.body.name, channelId } });
});

projectsRouter.patch('/:projectId', requireAuth, requireGuildAdmin, validateBody(UpdateProjectSchema), async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  const projectId = req.params.projectId;

  const project = (await db.prepare('SELECT * FROM projects WHERE id = ? AND guild_id = ?').get(projectId, req.params.guildId)) as any;
  if (!project) return res.status(404).json({ success: false, error: 'Projet introuvable.' });

  const updates: string[] = [];
  const params: any[] = [];

  if (req.body.name) { updates.push('name = ?'); params.push(req.body.name); }
  if (req.body.description) { updates.push('description = ?'); params.push(req.body.description); }
  if (req.body.leaderId) { updates.push('leader_id = ?'); params.push(req.body.leaderId); }
  if (req.body.status) {
    updates.push('status = ?');
    params.push(req.body.status);

    if (req.body.status === 'archived' && project.channel_id && guild) {
      const channel = await guild.channels.fetch(project.channel_id).catch(() => null);
      if (channel && channel.isTextBased()) {
        await (channel as TextChannel).permissionOverwrites.edit(guild.id, { SendMessages: false }).catch(() => null);
      }
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(projectId);
    await db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json({ success: true, message: 'Projet mis à jour avec succès.' });
});
