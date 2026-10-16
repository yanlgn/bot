import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { validateBody } from '../middleware/validate.js';
import { discordClient } from '../botClient.js';
import {
  CreateChannelSchema,
  UpdateChannelSchema,
  sanitizeChannelName
} from '@sciclub/shared';
import { ChannelType, PermissionFlagsBits, TextChannel, VoiceChannel, CategoryChannel } from 'discord.js';
import { db } from '../db.js';
import { randomUUID } from 'crypto';

export const channelsRouter = Router({ mergeParams: true });

function recordAudit(guildId: string, userId: string, username: string, action: string, targetId: string, details: string) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, guild_id, user_id, username, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, 'channel', ?, ?, datetime('now'))
    `).run(randomUUID(), guildId, userId, username, action, targetId, details);
  } catch {}
}

/**
 * GET /api/guilds/:guildId/channels
 */
channelsRouter.get('/', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  try {
    const channels = await guild.channels.fetch();
    const list = Array.from(channels.values()).filter(Boolean).map(ch => {
      const c = ch!;
      let type = 'text';
      if (c.type === ChannelType.GuildVoice) type = 'voice';
      else if (c.type === ChannelType.GuildCategory) type = 'category';
      else if (c.type === ChannelType.GuildAnnouncement) type = 'announcement';
      else if (c.type === ChannelType.GuildForum) type = 'forum';

      const overwrites = 'permissionOverwrites' in c ? Array.from(c.permissionOverwrites.cache.values()).map(o => ({
        id: o.id,
        type: o.type === 0 ? 'role' : 'member',
        allow: o.allow.toArray(),
        deny: o.deny.toArray()
      })) : [];

      return {
        id: c.id,
        name: c.name,
        type,
        parentId: c.parentId,
        parentName: c.parent ? c.parent.name : null,
        position: 'rawPosition' in c ? c.rawPosition : 0,
        topic: 'topic' in c ? c.topic : null,
        rateLimitPerUser: 'rateLimitPerUser' in c ? c.rateLimitPerUser : 0,
        permissionOverwrites: overwrites
      };
    }).sort((a, b) => a.position - b.position);

    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/channels
 */
channelsRouter.post('/', requireAuth, requireGuildAdmin, validateBody(CreateChannelSchema), async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return res.status(403).json({ success: false, error: 'Le bot ne possède pas la permission "Gérer les salons".' });
  }

  let type = ChannelType.GuildText;
  if (req.body.type === 'voice') type = ChannelType.GuildVoice;
  else if (req.body.type === 'category') type = ChannelType.GuildCategory;
  else if (req.body.type === 'announcement') type = ChannelType.GuildAnnouncement;
  else if (req.body.type === 'forum') type = ChannelType.GuildForum;

  try {
    const user = req.session.user!;
    const name = type === ChannelType.GuildCategory ? req.body.name : sanitizeChannelName(req.body.name);

    const created = await guild.channels.create({
      name,
      type,
      parent: req.body.parentId || undefined,
      topic: req.body.topic,
      rateLimitPerUser: req.body.rateLimitPerUser,
      nsfw: req.body.nsfw,
      reason: `Créé par ${user.username} via le Dashboard SciClub`
    });

    recordAudit(guild.id, user.id, user.username, 'CHANNEL_CREATED', created.id, `Salon #${created.name} (${req.body.type}) créé`);

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        name: created.name,
        type: req.body.type,
        parentId: created.parentId
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/guilds/:guildId/channels/:channelId
 */
channelsRouter.patch('/:channelId', requireAuth, requireGuildAdmin, validateBody(UpdateChannelSchema), async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const channel = await guild.channels.fetch(req.params.channelId);
  if (!channel) return res.status(404).json({ success: false, error: 'Salon introuvable.' });

  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return res.status(403).json({ success: false, error: 'Le bot ne possède pas la permission "Gérer les salons".' });
  }

  const user = req.session.user!;

  try {
    // Verrouillage / Déverrouillage si spécifié
    if (typeof req.body.isLocked === 'boolean' && 'permissionOverwrites' in channel) {
      await (channel as TextChannel).permissionOverwrites.edit(guild.id, {
        SendMessages: req.body.isLocked ? false : null
      });
    }

    const editData: Record<string, any> = {};
    if (req.body.name) {
      editData.name = channel.type === ChannelType.GuildCategory ? req.body.name : sanitizeChannelName(req.body.name);
    }
    if (req.body.parentId !== undefined) {
      editData.parent = req.body.parentId;
    }
    if (req.body.topic !== undefined && 'setTopic' in channel) {
      editData.topic = req.body.topic;
    }
    if (req.body.rateLimitPerUser !== undefined && 'setRateLimitPerUser' in channel) {
      editData.rateLimitPerUser = req.body.rateLimitPerUser;
    }

    const updated = await (channel as TextChannel | VoiceChannel | CategoryChannel).edit(editData);
    recordAudit(guild.id, user.id, user.username, 'CHANNEL_UPDATED', channel.id, `Salon #${updated.name} modifié`);

    res.json({ success: true, data: { id: updated.id, name: updated.name } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/guilds/:guildId/channels/:channelId
 */
channelsRouter.delete('/:channelId', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const channel = await guild.channels.fetch(req.params.channelId);
  if (!channel) return res.status(404).json({ success: false, error: 'Salon introuvable.' });

  const user = req.session.user!;
  const channelName = channel.name;

  try {
    await channel.delete(`Supprimé par ${user.username} depuis SciClub Manager`);
    recordAudit(guild.id, user.id, user.username, 'CHANNEL_DELETED', req.params.channelId, `Salon #${channelName} supprimé`);
    res.json({ success: true, message: `Salon #${channelName} supprimé avec succès.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
