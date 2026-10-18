import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { validateBody } from '../middleware/validate.js';
import { discordClient } from '../botClient.js';
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  hexToDecimalColor,
  decimalToHexColor
} from '@sciclub/shared';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { db } from '../db.js';
import { randomUUID } from 'crypto';
import { addRoleToConfig } from '../utils/configHelper.js';

export const rolesRouter = Router({ mergeParams: true });

// Audit log helper
async function recordAudit(guildId: string, userId: string, username: string, action: string, targetId: string, details: string) {
  try {
    await db.prepare(`
      INSERT INTO audit_logs (id, guild_id, user_id, username, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, 'role', ?, ?, datetime('now'))
    `).run(randomUUID(), guildId, userId, username, action, targetId, details);
  } catch {}
}

/**
 * GET /api/guilds/:guildId/roles
 */
rolesRouter.get('/', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  try {
    const roles = await guild.roles.fetch();
    const botMember = await guild.members.fetchMe();
    const botHighest = botMember.roles.highest;

    const list = Array.from(roles.values()).map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      hexColor: decimalToHexColor(r.color),
      position: r.position,
      hoist: r.hoist,
      managed: r.managed,
      mentionable: r.mentionable,
      permissions: r.permissions.toArray(),
      memberCount: r.members.size,
      isBotHighest: r.id === botHighest.id,
      isEditable: r.id !== guild.id && !r.managed && botHighest.comparePositionTo(r) > 0
    })).sort((a, b) => b.position - a.position);

    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/roles
 */
rolesRouter.post('/', requireAuth, requireGuildAdmin, validateBody(CreateRoleSchema), async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const user = req.session.user!;
  const operatorMember = await guild.members.fetch(user.id);
  const botMember = await guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return res.status(403).json({ success: false, error: 'Le bot ne possède pas la permission "Gérer les rôles".' });
  }

  // Protection anti-élévation de privilèges
  if (req.body.permissions.includes('Administrator') && !operatorMember.permissions.has(PermissionFlagsBits.Administrator)) {
    return res.status(403).json({ success: false, error: 'Vous ne pouvez pas accorder la permission Administrateur sans l\'avoir vous-même.' });
  }

  try {
    const bitfield = new PermissionsBitField();
    for (const p of req.body.permissions) {
      if (p in PermissionFlagsBits) {
        bitfield.add(PermissionFlagsBits[p as keyof typeof PermissionFlagsBits]);
      }
    }

    const created = await guild.roles.create({
      name: req.body.name,
      color: hexToDecimalColor(req.body.color),
      hoist: req.body.hoist,
      mentionable: req.body.mentionable,
      permissions: bitfield,
      reason: `Créé par ${user.username} via le Dashboard SciClub`
    });

    recordAudit(guild.id, user.id, user.username, 'ROLE_CREATED', created.id, `Rôle "${created.name}" créé`);

    // Synchronisation automatique dans config/guilds/{guildId}.json
    try {
      const roleKey = created.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      addRoleToConfig(guild.id, roleKey, {
        name: created.name,
        color: decimalToHexColor(created.color),
        permissions: created.permissions.toArray()
      });
    } catch {}

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        name: created.name,
        color: created.color,
        hexColor: decimalToHexColor(created.color),
        position: created.position,
        permissions: created.permissions.toArray()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/guilds/:guildId/roles/:roleId
 */
rolesRouter.patch('/:roleId', requireAuth, requireGuildAdmin, validateBody(UpdateRoleSchema), async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const roleId = req.params.roleId;
  if (roleId === guild.id) {
    return res.status(400).json({ success: false, error: 'Impossible de modifier directement @everyone.' });
  }

  const role = await guild.roles.fetch(roleId);
  if (!role) return res.status(404).json({ success: false, error: 'Rôle introuvable.' });

  const user = req.session.user!;
  const operatorMember = await guild.members.fetch(user.id);
  const botMember = await guild.members.fetchMe();

  if (botMember.roles.highest.comparePositionTo(role) <= 0) {
    return res.status(403).json({ success: false, error: 'Ce rôle est supérieur ou égal au rôle le plus élevé du bot.' });
  }

  if (guild.ownerId !== user.id && operatorMember.roles.highest.comparePositionTo(role) <= 0) {
    return res.status(403).json({ success: false, error: 'Vous ne pouvez pas modifier un rôle supérieur ou égal au vôtre.' });
  }

  let bitfield: PermissionsBitField | undefined = undefined;
  if (req.body.permissions) {
    if (req.body.permissions.includes('Administrator') && !operatorMember.permissions.has(PermissionFlagsBits.Administrator)) {
      return res.status(403).json({ success: false, error: 'Interdiction d\'attribuer la permission Administrateur sans l\'avoir vous-même.' });
    }
    bitfield = new PermissionsBitField();
    for (const p of req.body.permissions) {
      if (p in PermissionFlagsBits) bitfield.add(PermissionFlagsBits[p as keyof typeof PermissionFlagsBits]);
    }
  }

  try {
    const updated = await role.edit({
      name: req.body.name ?? role.name,
      color: req.body.color ? hexToDecimalColor(req.body.color) : role.color,
      hoist: req.body.hoist ?? role.hoist,
      mentionable: req.body.mentionable ?? role.mentionable,
      permissions: bitfield ?? role.permissions
    });

    recordAudit(guild.id, user.id, user.username, 'ROLE_UPDATED', role.id, `Rôle "${updated.name}" mis à jour`);

    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        color: updated.color,
        hexColor: decimalToHexColor(updated.color),
        permissions: updated.permissions.toArray()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/guilds/:guildId/roles/:roleId
 */
rolesRouter.delete('/:roleId', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const roleId = req.params.roleId;
  if (roleId === guild.id) {
    return res.status(400).json({ success: false, error: 'Impossible de supprimer @everyone.' });
  }

  const role = await guild.roles.fetch(roleId);
  if (!role) return res.status(404).json({ success: false, error: 'Rôle introuvable.' });

  const user = req.session.user!;
  const operatorMember = await guild.members.fetch(user.id);
  const botMember = await guild.members.fetchMe();

  if (botMember.roles.highest.comparePositionTo(role) <= 0) {
    return res.status(403).json({ success: false, error: 'Ce rôle est supérieur ou égal au rôle le plus élevé du bot.' });
  }

  if (guild.ownerId !== user.id && operatorMember.roles.highest.comparePositionTo(role) <= 0) {
    return res.status(403).json({ success: false, error: 'Vous ne pouvez pas supprimer un rôle supérieur ou égal au vôtre.' });
  }

  try {
    const roleName = role.name;
    await role.delete(`Supprimé par ${user.username} via SciClub Manager`);
    recordAudit(guild.id, user.id, user.username, 'ROLE_DELETED', roleId, `Rôle "${roleName}" supprimé`);
    res.json({ success: true, message: `Rôle "${roleName}" supprimé avec succès.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
