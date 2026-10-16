import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { discordClient } from '../botClient.js';
import { hasPermissionBit } from '@sciclub/shared';

export const meRouter = Router();

meRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = req.session.user!;

  try {
    // Récupérer les guildes de l'utilisateur depuis l'API Discord
    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
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

    // Filtre les guildes où le bot est présent ET où l'utilisateur est admin ou manage_guild
    const manageableGuilds = userGuilds
      .filter(g => {
        const botGuild = discordClient.guilds.cache.get(g.id);
        if (!botGuild) return false;

        const isAdmin = g.owner || hasPermissionBit(g.permissions, 'Administrator') || hasPermissionBit(g.permissions, 'ManageGuild');
        return isAdmin;
      })
      .map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
        owner: g.owner,
        hasBot: true
      }));

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
