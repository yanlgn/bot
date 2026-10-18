import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { discordClient } from '../botClient.js';
import { db } from '../db.js';

export const statsRouter = Router({ mergeParams: true });

statsRouter.get('/', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const projectCount = ((await db.prepare('SELECT COUNT(*) as count FROM projects WHERE guild_id = ?').get(guild.id)) as any)?.count || 0;
  const eventCount = ((await db.prepare('SELECT COUNT(*) as count FROM events WHERE guild_id = ?').get(guild.id)) as any)?.count || 0;
  const resourceCount = ((await db.prepare('SELECT COUNT(*) as count FROM resources WHERE guild_id = ?').get(guild.id)) as any)?.count || 0;
  const warningCount = ((await db.prepare('SELECT COUNT(*) as count FROM warnings WHERE guild_id = ?').get(guild.id)) as any)?.count || 0;

  const topPoints = (await db.prepare(`
    SELECT user_id as userId, balance
    FROM points
    WHERE guild_id = ?
    ORDER BY balance DESC
    LIMIT 5
  `).all(guild.id)) as { userId: string; balance: number }[];

  const recentLogs = await db.prepare(`
    SELECT id, user_id as userId, username, action, target_type as targetType, details, created_at as createdAt
    FROM audit_logs
    WHERE guild_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(guild.id);

  res.json({
    success: true,
    data: {
      guild: {
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconURL(),
        memberCount: guild.memberCount,
        roleCount: guild.roles.cache.size,
        channelCount: guild.channels.cache.size
      },
      counts: {
        projects: projectCount,
        events: eventCount,
        resources: resourceCount,
        warnings: warningCount
      },
      topMembers: topPoints,
      recentActivity: recentLogs
    }
  });
});
