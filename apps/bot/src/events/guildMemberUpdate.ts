import { Events, GuildMember, PartialGuildMember } from 'discord.js';
import { db } from '../database/db.js';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

export const name = Events.GuildMemberUpdate;
export const once = false;

async function recordAudit(guildId: string, userId: string, username: string, action: string, targetId: string, details: string) {
  try {
    await db.prepare(`
      INSERT INTO audit_logs (id, guild_id, user_id, username, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, 'department_member', ?, ?, datetime('now'))
    `).run(randomUUID(), guildId, userId, username, action, targetId, details);
  } catch {}
}

export async function execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
  try {
    const guildId = newMember.guild.id;

    // Sauvegarder/mettre à jour l'utilisateur en base
    try {
      await db.prepare(`
        INSERT INTO users (id, username, discriminator, avatar)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          username = excluded.username,
          discriminator = excluded.discriminator,
          avatar = excluded.avatar
      `).run(
        newMember.user.id,
        newMember.user.username,
        newMember.user.discriminator || '0',
        newMember.user.avatar || null
      );
    } catch {}

    // Récupérer les départements du serveur
    const departments = (await db.prepare(`
      SELECT * FROM departments 
      WHERE guild_id = ? AND is_archived = 0
    `).all(guildId)) as any[];

    if (!departments || departments.length === 0) return;

    const oldRoles = oldMember.roles?.cache;
    const newRoles = newMember.roles.cache;

    if (!oldRoles) return;

    for (const dept of departments) {
      const leaderRoleId = dept.leader_role_id;
      const deputyRoleId = dept.deputy_role_id;
      const memberRoleId = dept.member_role_id;

      // 1. Chef de pôle (Leader Role)
      if (leaderRoleId) {
        const hadLeader = oldRoles.has(leaderRoleId);
        const hasLeader = newRoles.has(leaderRoleId);

        if (!hadLeader && hasLeader) {
          // Attribué en chef de pôle
          await db.prepare(`
            INSERT INTO department_members (department_id, guild_id, user_id, role, status, requested_at, reviewed_at)
            VALUES (?, ?, ?, 'leader', 'approved', datetime('now'), datetime('now'))
            ON CONFLICT(department_id, user_id) DO UPDATE SET
              role = 'leader',
              status = 'approved',
              reviewed_at = datetime('now')
          `).run(dept.id, guildId, newMember.user.id);

          recordAudit(guildId, newMember.user.id, newMember.user.username, 'DEPARTMENT_LEADER_ASSIGNED', dept.id, `Attribué Chef de pôle "${dept.name}" via rôle Discord`);
          logger.info(`👑 ${newMember.user.tag} est devenu Chef du pôle "${dept.name}" (Discord rôle détecté)`);
        } else if (hadLeader && !hasLeader) {
          // Retiré du rôle chef de pôle
          if (deputyRoleId && newRoles.has(deputyRoleId)) {
            await db.prepare(`
              UPDATE department_members 
              SET role = 'deputy', updated_at = datetime('now')
              WHERE department_id = ? AND user_id = ?
            `).run(dept.id, newMember.user.id);
          } else if (memberRoleId && newRoles.has(memberRoleId)) {
            await db.prepare(`
              UPDATE department_members 
              SET role = 'member', updated_at = datetime('now')
              WHERE department_id = ? AND user_id = ?
            `).run(dept.id, newMember.user.id);
          } else {
            await db.prepare(`
              DELETE FROM department_members
              WHERE department_id = ? AND user_id = ?
            `).run(dept.id, newMember.user.id);
          }
          recordAudit(guildId, newMember.user.id, newMember.user.username, 'DEPARTMENT_LEADER_REMOVED', dept.id, `Retiré du rôle Chef de pôle "${dept.name}" via rôle Discord`);
          logger.info(`🔻 ${newMember.user.tag} n'est plus Chef du pôle "${dept.name}"`);
        }
      }

      // 2. Adjoint / Vice-Chef de pôle (Deputy Role)
      if (deputyRoleId) {
        const hadDeputy = oldRoles.has(deputyRoleId);
        const hasDeputy = newRoles.has(deputyRoleId);

        if (!hadDeputy && hasDeputy) {
          // Attribué en adjoint (si pas déjà leader)
          const isLeader = leaderRoleId && newRoles.has(leaderRoleId);
          const assignedRole = isLeader ? 'leader' : 'deputy';

          await db.prepare(`
            INSERT INTO department_members (department_id, guild_id, user_id, role, status, requested_at, reviewed_at)
            VALUES (?, ?, ?, ?, 'approved', datetime('now'), datetime('now'))
            ON CONFLICT(department_id, user_id) DO UPDATE SET
              role = ?,
              status = 'approved',
              reviewed_at = datetime('now')
          `).run(dept.id, guildId, newMember.user.id, assignedRole, assignedRole);

          recordAudit(guildId, newMember.user.id, newMember.user.username, 'DEPARTMENT_DEPUTY_ASSIGNED', dept.id, `Attribué Adjoint du pôle "${dept.name}" via rôle Discord`);
          logger.info(`🥈 ${newMember.user.tag} est devenu Adjoint du pôle "${dept.name}" (Discord rôle détecté)`);
        } else if (hadDeputy && !hasDeputy) {
          // Retiré du rôle adjoint
          const isLeader = leaderRoleId && newRoles.has(leaderRoleId);
          if (!isLeader) {
            if (memberRoleId && newRoles.has(memberRoleId)) {
              await db.prepare(`
                UPDATE department_members 
                SET role = 'member', updated_at = datetime('now')
                WHERE department_id = ? AND user_id = ?
              `).run(dept.id, newMember.user.id);
            } else {
              await db.prepare(`
                DELETE FROM department_members
                WHERE department_id = ? AND user_id = ?
              `).run(dept.id, newMember.user.id);
            }
            recordAudit(guildId, newMember.user.id, newMember.user.username, 'DEPARTMENT_DEPUTY_REMOVED', dept.id, `Retiré du rôle Adjoint du pôle "${dept.name}" via rôle Discord`);
            logger.info(`🔻 ${newMember.user.tag} n'est plus Adjoint du pôle "${dept.name}"`);
          }
        }
      }

      // 3. Membre de pôle (Member Role)
      if (memberRoleId) {
        const hadMember = oldRoles.has(memberRoleId);
        const hasMember = newRoles.has(memberRoleId);

        if (!hadMember && hasMember) {
          // Attribué en membre de pôle (si pas déjà leader ou adjoint)
          const isLeader = leaderRoleId && newRoles.has(leaderRoleId);
          const isDeputy = deputyRoleId && newRoles.has(deputyRoleId);
          const assignedRole = isLeader ? 'leader' : (isDeputy ? 'deputy' : 'member');

          await db.prepare(`
            INSERT INTO department_members (department_id, guild_id, user_id, role, status, requested_at, reviewed_at)
            VALUES (?, ?, ?, ?, 'approved', datetime('now'), datetime('now'))
            ON CONFLICT(department_id, user_id) DO UPDATE SET
              role = ?,
              status = 'approved',
              reviewed_at = datetime('now')
          `).run(dept.id, guildId, newMember.user.id, assignedRole, assignedRole);

          recordAudit(guildId, newMember.user.id, newMember.user.username, 'DEPARTMENT_MEMBER_ASSIGNED', dept.id, `Intégré comme Membre du pôle "${dept.name}" via rôle Discord`);
          logger.info(`👤 ${newMember.user.tag} est devenu Membre du pôle "${dept.name}" (Discord rôle détecté)`);
        } else if (hadMember && !hasMember) {
          // Retiré du rôle membre
          const isLeader = leaderRoleId && newRoles.has(leaderRoleId);
          const isDeputy = deputyRoleId && newRoles.has(deputyRoleId);
          if (!isLeader && !isDeputy) {
            await db.prepare(`
              DELETE FROM department_members
              WHERE department_id = ? AND user_id = ?
            `).run(dept.id, newMember.user.id);
            recordAudit(guildId, newMember.user.id, newMember.user.username, 'DEPARTMENT_MEMBER_REMOVED', dept.id, `Retiré du rôle Membre du pôle "${dept.name}" via rôle Discord`);
            logger.info(`🔻 ${newMember.user.tag} retiré du pôle "${dept.name}"`);
          }
        }
      }
    }
  } catch (err: any) {
    logger.error({ error: err }, 'Erreur lors de la synchronisation guildMemberUpdate pour les départements');
  }
}
