import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { discordClient } from '../botClient.js';
import { db } from '../db.js';
import { randomUUID } from 'crypto';

export const membersRouter = Router({ mergeParams: true });

async function recordAudit(guildId: string, userId: string, username: string, action: string, targetId: string, details: string) {
  try {
    await db.prepare(`
      INSERT INTO audit_logs (id, guild_id, user_id, username, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, 'member', ?, ?, datetime('now'))
    `).run(randomUUID(), guildId, userId, username, action, targetId, details);
  } catch {}
}

/**
 * GET /api/guilds/:guildId/members
 */
membersRouter.get('/', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  try {
    const fetched = await guild.members.fetch({ limit: 100 });

    const pointsRows = (await db.prepare('SELECT user_id, balance FROM points WHERE guild_id = ?').all(guild.id)) as any[];
    const pointsMap = new Map(pointsRows.map(r => [r.user_id, r.balance]));

    const warnRows = (await db.prepare('SELECT user_id, COUNT(*) as count FROM warnings WHERE guild_id = ? GROUP BY user_id').all(guild.id)) as any[];
    const warnMap = new Map(warnRows.map(r => [r.user_id, r.count]));

    const list = Array.from(fetched.values()).map(m => ({
      id: m.id,
      username: m.user.username,
      discriminator: m.user.discriminator,
      globalName: m.user.globalName,
      nickname: m.nickname,
      avatarUrl: m.user.displayAvatarURL(),
      roles: Array.from(m.roles.cache.keys()).filter(id => id !== guild.id),
      joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
      isBot: m.user.bot,
      points: pointsMap.get(m.id) || 0,
      warningsCount: warnMap.get(m.id) || 0
    }));

    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/members/:memberId/roles
 */
membersRouter.post('/:memberId/roles', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const { roleId } = req.body;
  if (!roleId) return res.status(400).json({ success: false, error: 'roleId requis.' });

  const member = await guild.members.fetch(req.params.memberId);
  const role = await guild.roles.fetch(roleId);
  if (!member || !role) return res.status(404).json({ success: false, error: 'Membre ou rôle introuvable.' });

  const user = req.session.user!;
  const operatorMember = await guild.members.fetch(user.id);
  const botMember = await guild.members.fetchMe();

  if (botMember.roles.highest.comparePositionTo(role) <= 0) {
    return res.status(403).json({ success: false, error: 'Le rôle est supérieur ou égal au rôle le plus élevé du bot.' });
  }

  if (guild.ownerId !== user.id && operatorMember.roles.highest.comparePositionTo(role) <= 0) {
    return res.status(403).json({ success: false, error: 'Vous ne pouvez pas attribuer un rôle supérieur ou égal au vôtre.' });
  }

  try {
    await member.roles.add(role, `Attribué par ${user.username} via SciClub Manager`);
    recordAudit(guild.id, user.id, user.username, 'ROLE_ASSIGNED', member.id, `Rôle "${role.name}" attribué à ${member.user.tag}`);
    res.json({ success: true, message: `Rôle "${role.name}" attribué.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/guilds/:guildId/members/:memberId/roles/:roleId
 */
membersRouter.delete('/:memberId/roles/:roleId', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const member = await guild.members.fetch(req.params.memberId);
  const role = await guild.roles.fetch(req.params.roleId);
  if (!member || !role) return res.status(404).json({ success: false, error: 'Membre ou rôle introuvable.' });

  const user = req.session.user!;
  const operatorMember = await guild.members.fetch(user.id);
  const botMember = await guild.members.fetchMe();

  if (botMember.roles.highest.comparePositionTo(role) <= 0) {
    return res.status(403).json({ success: false, error: 'Le rôle est supérieur ou égal au rôle le plus élevé du bot.' });
  }

  if (guild.ownerId !== user.id && operatorMember.roles.highest.comparePositionTo(role) <= 0) {
    return res.status(403).json({ success: false, error: 'Vous ne pouvez pas retirer un rôle supérieur ou égal au vôtre.' });
  }

  try {
    await member.roles.remove(role, `Retiré par ${user.username} via SciClub Manager`);
    recordAudit(guild.id, user.id, user.username, 'ROLE_REMOVED', member.id, `Rôle "${role.name}" retiré à ${member.user.tag}`);
    res.json({ success: true, message: `Rôle "${role.name}" retiré.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/members/:memberId/timeout
 */
membersRouter.post('/:memberId/timeout', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const { durationMinutes = 60, reason = 'Modération via Dashboard' } = req.body;
  const member = await guild.members.fetch(req.params.memberId);
  if (!member) return res.status(404).json({ success: false, error: 'Membre introuvable.' });

  const user = req.session.user!;
  const operatorMember = await guild.members.fetch(user.id);

  if (!member.moderatable) {
    return res.status(403).json({ success: false, error: 'Le bot ne peut pas modérer ce membre (hiérarchie ou permissions supérieures).' });
  }

  if (guild.ownerId !== user.id && operatorMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
    return res.status(403).json({ success: false, error: 'Vous ne pouvez pas modérer un membre supérieur ou égal à vous dans la hiérarchie.' });
  }

  try {
    await member.timeout(durationMinutes * 60 * 1000, `${reason} (par ${user.username})`);
    recordAudit(guild.id, user.id, user.username, 'MEMBER_TIMEOUT', member.id, `Timeout de ${durationMinutes}m pour ${member.user.tag}`);
    res.json({ success: true, message: `Timeout de ${durationMinutes} minutes appliqué à ${member.user.tag}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/members/:memberId/kick
 */
membersRouter.post('/:memberId/kick', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const { reason = 'Expulsion via Dashboard' } = req.body;
  const member = await guild.members.fetch(req.params.memberId);
  if (!member) return res.status(404).json({ success: false, error: 'Membre introuvable.' });

  const user = req.session.user!;
  const operatorMember = await guild.members.fetch(user.id);

  if (!member.kickable) {
    return res.status(403).json({ success: false, error: 'Le bot ne peut pas expulser ce membre.' });
  }

  if (guild.ownerId !== user.id && operatorMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
    return res.status(403).json({ success: false, error: 'Vous ne pouvez pas expulser un membre supérieur ou égal.' });
  }

  try {
    await member.kick(`${reason} (par ${user.username})`);
    recordAudit(guild.id, user.id, user.username, 'MEMBER_KICKED', member.id, `Expulsion de ${member.user.tag}`);
    res.json({ success: true, message: `${member.user.tag} expulsé.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/members/:memberId/ban
 */
membersRouter.post('/:memberId/ban', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const { reason = 'Bannissement via Dashboard' } = req.body;
  const member = await guild.members.fetch(req.params.memberId).catch(() => null);

  const user = req.session.user!;
  const operatorMember = await guild.members.fetch(user.id);

  if (member && !member.bannable) {
    return res.status(403).json({ success: false, error: 'Le bot ne peut pas bannir ce membre.' });
  }

  if (member && guild.ownerId !== user.id && operatorMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
    return res.status(403).json({ success: false, error: 'Vous ne pouvez pas bannir un membre supérieur ou égal.' });
  }

  try {
    await guild.members.ban(req.params.memberId, { reason: `${reason} (par ${user.username})` });
    recordAudit(guild.id, user.id, user.username, 'MEMBER_BANNED', req.params.memberId, `Bannissement du membre ${req.params.memberId}`);
    res.json({ success: true, message: 'Membre banni avec succès.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
