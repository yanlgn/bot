import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { discordClient } from '../botClient.js';
import { db } from '../db.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export const moderationRouter = Router({ mergeParams: true });

function getGuildConfig(guildId: string) {
  try {
    const configPath = path.resolve(process.cwd(), process.env.CONFIG_PATH || './config/guilds', `${guildId}.json`);
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch {}
  return null;
}

moderationRouter.get('/warnings', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const warnings = await db.prepare(`
    SELECT id, guild_id as guildId, user_id as userId, moderator_id as moderatorId, reason, created_at as createdAt
    FROM warnings
    WHERE guild_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(req.params.guildId);

  res.json({ success: true, data: warnings });
});

moderationRouter.post('/warn', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const { userId, reason } = req.body;
  if (!userId || !reason) return res.status(400).json({ success: false, error: 'userId et reason requis.' });

  const user = req.session.user!;
  const warningId = randomUUID();

  await db.prepare(`
    INSERT INTO warnings (id, guild_id, user_id, moderator_id, reason, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(warningId, guild.id, userId, user.id, reason);

  const countRow = (await db.prepare('SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ?')
    .get(guild.id, userId)) as { count: number };
  const warningCount = countRow.count;

  const config = getGuildConfig(guild.id);
  const maxWarnings = config?.moderation?.maxWarnings ?? 3;
  const autoMuteMinutes = config?.moderation?.autoMuteDurationMinutes ?? 60;
  let autoMuted = false;

  if (warningCount >= maxWarnings) {
    try {
      const member = await guild.members.fetch(userId);
      if (member.moderatable) {
        await member.timeout(autoMuteMinutes * 60 * 1000, `Seuil de ${maxWarnings} avertissements atteint`);
        autoMuted = true;
      }
    } catch {}
  }

  res.json({
    success: true,
    data: {
      warningCount,
      autoMuted,
      message: autoMuted ? `Avertissement enregistré. Seuil de ${maxWarnings} atteint : timeout de ${autoMuteMinutes} min appliqué !` : `Avertissement enregistré (${warningCount}/${maxWarnings}).`
    }
  });
});
