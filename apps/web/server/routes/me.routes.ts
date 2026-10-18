import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { discordClient } from '../botClient.js';
import { hasPermissionBit } from '@sciclub/shared';

export const meRouter = Router();

meRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = req.session.user!;

  try {
    // Récupérer les guildes de l'utilisateur depuis l'API Discord v10
    const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${user.accessToken}` }
    });

    if (!guildsRes.ok) {
      return res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator,
          avatar: user.avatar,
          guilds: []
        }
      });
    }

    const userGuilds = (await guildsRes.json()) as Array<{
      id: string;
      name: string;
      icon: string | null;
      owner: boolean;
      permissions: string;
    }>;

    // 1. Récupérer la liste des serveurs où le bot est installé via l'API REST Discord (source de vérité absolue)
    const botToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
    const botGuildIds = new Set<string>();

    // Ajouter les guildes depuis le cache Discord.js
    for (const guildId of discordClient.guilds.cache.keys()) {
      botGuildIds.add(guildId);
    }

    // Requêter l'API REST de Discord pour avoir la liste exhaustive en direct
    if (botToken) {
      try {
        const botGuildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          headers: { Authorization: `Bot ${botToken}` }
        });
        if (botGuildsRes.ok) {
          const botGuilds = (await botGuildsRes.json()) as Array<{ id: string }>;
          for (const bg of botGuilds) {
            botGuildIds.add(bg.id);
          }
        }
      } catch (err) {
        // En cas d'erreur réseau, s'appuie sur le cache
      }
    }

    // 2. Traiter les guildes de l'utilisateur
    const manageableGuilds = userGuilds
      .filter(g => {
        const hasBot = botGuildIds.has(g.id);
        // Si le bot est sur le serveur, on l'affiche TOUJOURS
        if (hasBot) return true;

        // Sinon, on l'affiche si l'utilisateur est admin ou propriétaire pour lui permettre d'inviter le bot
        const isAdmin = g.owner ||
          hasPermissionBit(g.permissions, 'Administrator') ||
          hasPermissionBit(g.permissions, 'ManageGuild') ||
          hasPermissionBit(g.permissions, 'ManageRoles') ||
          hasPermissionBit(g.permissions, 'ManageChannels');
        return isAdmin;
      })
      .map(g => {
        const hasBot = botGuildIds.has(g.id);
        return {
          id: g.id,
          name: g.name,
          icon: g.icon,
          iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
          owner: g.owner,
          hasBot
        };
      });

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        guilds: manageableGuilds
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
