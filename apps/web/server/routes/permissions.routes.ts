import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { validateBody } from '../middleware/validate.js';
import { discordClient } from '../botClient.js';
import { UpdateChannelPermissionSchema, DISCORD_PERMISSIONS } from '@sciclub/shared';
import { PermissionFlagsBits, TextChannel, VoiceChannel, CategoryChannel, ForumChannel } from 'discord.js';
import { db } from '../db.js';
import { randomUUID } from 'crypto';

export const permissionsRouter = Router({ mergeParams: true });

async function recordAudit(guildId: string, userId: string, username: string, action: string, targetId: string, details: string) {
  try {
    await db.prepare(`
      INSERT INTO audit_logs (id, guild_id, user_id, username, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, 'permission', ?, ?, datetime('now'))
    `).run(randomUUID(), guildId, userId, username, action, targetId, details);
  } catch {}
}

/**
 * GET /api/guilds/:guildId/permissions
 * Retourne la liste des permissions Discord supportées avec libellés et métadonnées
 */
permissionsRouter.get('/', requireAuth, requireGuildAdmin, (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      availablePermissions: DISCORD_PERMISSIONS
    }
  });
});

/**
 * PUT /api/guilds/:guildId/channels/:channelId/permissions
 * Définit les overwrites pour un rôle ou un membre (ALLOW / DENY / NEUTRAL)
 */
permissionsRouter.put('/:channelId/permissions', requireAuth, requireGuildAdmin, validateBody(UpdateChannelPermissionSchema), async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const channel = await guild.channels.fetch(req.params.channelId);
  if (!channel || !('permissionOverwrites' in channel)) {
    return res.status(404).json({ success: false, error: 'Salon introuvable ou ne gère pas les permissions.' });
  }

  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return res.status(403).json({ success: false, error: 'Le bot doit avoir les permissions "Gérer les salons" et "Gérer les rôles".' });
  }

  const { targetId, targetType, permissions } = req.body;

  // Conversion en objet Discord.js : true (ALLOW), false (DENY), null (NEUTRAL)
  const discordOverwrites: Record<string, boolean | null> = {};

  for (const [permFlag, state] of Object.entries(permissions)) {
    if (!(permFlag in PermissionFlagsBits)) continue;

    const flagBit = PermissionFlagsBits[permFlag as keyof typeof PermissionFlagsBits];
    if (state === 'ALLOW' && !botMember.permissions.has(flagBit)) {
      return res.status(403).json({
        success: false,
        error: `Le bot ne possède pas la permission "${permFlag}" et ne peut donc pas l'accorder.`
      });
    }

    if (state === 'ALLOW') discordOverwrites[permFlag] = true;
    else if (state === 'DENY') discordOverwrites[permFlag] = false;
    else discordOverwrites[permFlag] = null;
  }

  try {
    const typedChannel = channel as TextChannel | VoiceChannel | CategoryChannel | ForumChannel;
    await typedChannel.permissionOverwrites.edit(targetId, discordOverwrites, {
      type: targetType === 'role' ? 0 : 1
    });

    const user = req.session.user!;
    recordAudit(guild.id, user.id, user.username, 'PERMISSION_OVERWRITE_UPDATED', `${channel.id}:${targetId}`, `Permissions modifiées sur #${typedChannel.name}`);

    res.json({ success: true, message: 'Permissions de salon appliquées avec succès.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/guilds/:guildId/channels/:channelId/permissions/:targetId
 */
permissionsRouter.delete('/:channelId/permissions/:targetId', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const channel = await guild.channels.fetch(req.params.channelId);
  if (!channel || !('permissionOverwrites' in channel)) {
    return res.status(404).json({ success: false, error: 'Salon introuvable.' });
  }

  try {
    const typedChannel = channel as TextChannel | VoiceChannel | CategoryChannel | ForumChannel;
    await typedChannel.permissionOverwrites.delete(req.params.targetId);

    const user = req.session.user!;
    recordAudit(guild.id, user.id, user.username, 'PERMISSION_OVERWRITE_DELETED', `${channel.id}:${req.params.targetId}`, `Permissions réinitialisées sur #${typedChannel.name}`);

    res.json({ success: true, message: 'Permissions réinitialisées.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
