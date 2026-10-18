import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { discordClient } from '../botClient.js';

export const guildsRouter = Router();

guildsRouter.get('/:guildId', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId) || await discordClient.guilds.fetch(req.params.guildId).catch(() => null);
  if (!guild) {
    return res.status(404).json({ success: false, error: 'Serveur introuvable.' });
  }

  const botMember = await guild.members.fetchMe();

  res.json({
    success: true,
    data: {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      iconUrl: guild.iconURL(),
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      roleCount: guild.roles.cache.size,
      channelCount: guild.channels.cache.size,
      botPermissions: botMember.permissions.toArray(),
      botHighestRole: {
        id: botMember.roles.highest.id,
        name: botMember.roles.highest.name,
        position: botMember.roles.highest.position
      }
    }
  });
});
