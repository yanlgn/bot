import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { validateBody } from '../middleware/validate.js';
import { discordClient } from '../botClient.js';
import {
  CreateDepartmentSchema,
  ReviewDepartmentMemberSchema,
  hexToDecimalColor,
  sanitizeChannelName
} from '@sciclub/shared';
import {
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { db } from '../db.js';
import { randomUUID } from 'crypto';
import { addDepartmentToConfig, removeDepartmentFromConfig } from '../utils/configHelper.js';

export const departmentsRouter = Router({ mergeParams: true });

async function recordAudit(guildId: string, userId: string, username: string, action: string, targetId: string, details: string) {
  try {
    await db.prepare(`
      INSERT INTO audit_logs (id, guild_id, user_id, username, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, 'department', ?, ?, datetime('now'))
    `).run(randomUUID(), guildId, userId, username, action, targetId, details);
  } catch {}
}

/**
 * GET /api/guilds/:guildId/departments
 */
departmentsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId;
    const departments = (await db.prepare(`
      SELECT 
        d.*,
        (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id AND dm.status = 'approved') as member_count,
        (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id AND dm.status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM projects p WHERE p.department_id = d.id) as project_count
      FROM departments d
      WHERE d.guild_id = ? AND d.is_archived = 0
      ORDER BY d.created_at ASC
    `).all(guildId)) as any[];

    // Compléter avec les données Discord (noms des rôles et catégories)
    const guild = discordClient.guilds.cache.get(guildId);
    const enriched = departments.map(dept => {
      let leaderRoleName = null;
      let deputyRoleName = null;
      let memberRoleName = null;
      let categoryName = null;

      if (guild) {
        if (dept.leader_role_id) leaderRoleName = guild.roles.cache.get(dept.leader_role_id)?.name || null;
        if (dept.deputy_role_id) deputyRoleName = guild.roles.cache.get(dept.deputy_role_id)?.name || null;
        if (dept.member_role_id) memberRoleName = guild.roles.cache.get(dept.member_role_id)?.name || null;
        if (dept.category_id) categoryName = guild.channels.cache.get(dept.category_id)?.name || null;
      }

      return {
        id: dept.id,
        guildId: dept.guild_id,
        name: dept.name,
        shortName: dept.short_name,
        icon: dept.icon,
        color: dept.color,
        description: dept.description,
        leaderRoleId: dept.leader_role_id,
        leaderRoleName,
        deputyRoleId: dept.deputy_role_id,
        deputyRoleName,
        memberRoleId: dept.member_role_id,
        memberRoleName,
        categoryId: dept.category_id,
        categoryName,
        isArchived: Boolean(dept.is_archived),
        memberCount: dept.member_count,
        pendingCount: dept.pending_count,
        projectCount: dept.project_count,
        createdAt: dept.created_at
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/departments
 * Création complète d'un pôle en 1 clic
 */
departmentsRouter.post('/', requireAuth, requireGuildAdmin, validateBody(CreateDepartmentSchema), async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return res.status(403).json({ success: false, error: 'Le bot doit posséder les permissions "Gérer les salons" et "Gérer les rôles".' });
  }

  const user = req.session.user!;
  const body = req.body;
  const slug = (body.shortName || body.name).toLowerCase().replace(/[^a-z0-9]/g, '_');
  const deptId = `dept_${slug}_${Date.now().toString(36)}`;

  try {
    let leaderRole = null;
    let deputyRole = null;
    let memberRole = null;
    let category = null;
    const createdChannelsList: Array<{ name: string; type: 'text' | 'voice'; topic?: string; readonly?: boolean }> = [];

    // 1. Rôles Discord
    if (body.createRoles) {
      const colorDec = hexToDecimalColor(body.color);
      leaderRole = await guild.roles.create({
        name: `Chef Pôle ${body.shortName || body.name}`,
        color: colorDec,
        hoist: true,
        mentionable: true,
        reason: `Cortex : Création du pôle ${body.name}`
      });

      deputyRole = await guild.roles.create({
        name: `Adjoint Pôle ${body.shortName || body.name}`,
        color: colorDec,
        hoist: true,
        mentionable: true,
        reason: `Cortex : Création du pôle ${body.name}`
      });

      memberRole = await guild.roles.create({
        name: `Membre ${body.shortName || body.name}`,
        color: colorDec,
        hoist: false,
        mentionable: true,
        reason: `Cortex : Création du pôle ${body.name}`
      });

      // Si un chef a été désigné, lui assigner les rôles
      if (body.leaderUserId) {
        const leaderMember = await guild.members.fetch(body.leaderUserId).catch(() => null);
        if (leaderMember) {
          await leaderMember.roles.add([leaderRole.id, memberRole.id]).catch(() => null);
        }
      }

      // Si un adjoint a été désigné, lui assigner les rôles
      if (body.deputyUserId) {
        const deputyMember = await guild.members.fetch(body.deputyUserId).catch(() => null);
        if (deputyMember) {
          await deputyMember.roles.add([deputyRole.id, memberRole.id]).catch(() => null);
        }
      }
    }

    // 2. Catégorie Discord avec permissions atomiques
    if (body.createCategory) {
      const categoryOverwrites: any[] = [
        {
          id: botMember.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.SendMessages
          ]
        }
      ];

      if (leaderRole) {
        categoryOverwrites.push({
          id: leaderRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.MoveMembers
          ]
        });
      }

      if (deputyRole) {
        categoryOverwrites.push({
          id: deputyRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.MoveMembers
          ]
        });
      }

      if (memberRole) {
        categoryOverwrites.push({
          id: memberRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak
          ]
        });
      }

      category = await guild.channels.create({
        name: `${body.icon} PÔLE ${body.name.toUpperCase()}`,
        type: ChannelType.GuildCategory,
        permissionOverwrites: categoryOverwrites,
        reason: `Cortex : Catégorie du pôle ${body.name}`
      });
    }

    // 3. Salons dédiés avec permissions atomiques
    if (body.createChannels && category) {
      const channelConfigs = [
        { name: `annonces-${slug}`, type: 'text' as const, topic: `Annonces officielles du pôle ${body.name}`, readonly: true },
        { name: `candidatures-${slug}`, type: 'text' as const, topic: `Examen et validation des candidatures du pôle ${body.name}` },
        { name: `general-${slug}`, type: 'text' as const, topic: `Échanges scientifiques & discussions ${body.name}` },
        { name: `projets-${slug}`, type: 'text' as const, topic: `Projets et innovations du pôle ${body.name}` },
        { name: `ressources-${slug}`, type: 'text' as const, topic: `Partage de veille, articles et cours ${body.name}` },
        { name: `Atelier ${body.shortName || body.name}`, type: 'voice' as const }
      ];

      for (const ch of channelConfigs) {
        const chType = ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
        const channelOverwrites: any[] = [
          {
            id: botMember.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ];

        if (ch.name.startsWith('candidatures-')) {
          // STRICTEMENT PRIVÉ : invisible pour @everyone et membres du pôle, accessible uniquement par Chef, Adjoint et Bot
          channelOverwrites.push(
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            ...(memberRole ? [{ id: memberRole.id, deny: [PermissionFlagsBits.ViewChannel] }] : []),
            ...(leaderRole ? [{ id: leaderRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
            ...(deputyRole ? [{ id: deputyRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
          );
        } else if (ch.readonly) {
          // ANNONCES : visible de tous mais écriture réservée au Chef & Adjoint
          channelOverwrites.push(
            { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
            ...(memberRole ? [{ id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions], deny: [PermissionFlagsBits.SendMessages] }] : []),
            ...(leaderRole ? [{ id: leaderRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.MentionEveryone] }] : []),
            ...(deputyRole ? [{ id: deputyRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.MentionEveryone] }] : [])
          );
        } else if (ch.type === 'voice') {
          // VOCAL : réservé aux membres, adjoints et chefs du pôle
          channelOverwrites.push(
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
            ...(memberRole ? [{ id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] : []),
            ...(leaderRole ? [{ id: leaderRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.MoveMembers] }] : []),
            ...(deputyRole ? [{ id: deputyRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.MoveMembers] }] : [])
          );
        } else {
          // GENERAL, PROJETS, RESSOURCES : salons de travail réservés aux membres du pôle
          channelOverwrites.push(
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            ...(memberRole ? [{ id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] }] : []),
            ...(leaderRole ? [{ id: leaderRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }] : []),
            ...(deputyRole ? [{ id: deputyRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }] : [])
          );
        }

        await guild.channels.create({
          name: ch.type === 'voice' ? ch.name : sanitizeChannelName(ch.name),
          type: chType,
          parent: category.id,
          topic: ch.topic,
          permissionOverwrites: channelOverwrites,
          reason: `Cortex : Salon pôle ${body.name}`
        });

        createdChannelsList.push(ch);
      }
    }

    // 4. Enregistrement Base
    await db.prepare(`
      INSERT INTO departments (
        id, guild_id, name, short_name, icon, color, description, 
        leader_role_id, deputy_role_id, member_role_id, category_id, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, datetime('now'), datetime('now'))
    `).run(
      deptId,
      guild.id,
      body.name,
      body.shortName || null,
      body.icon || '🔬',
      body.color || '#E5092E',
      body.description || '',
      leaderRole?.id || null,
      deputyRole?.id || null,
      memberRole?.id || null,
      category?.id || null
    );

    // Si leader désigné, enregistrer dans department_members
    if (body.leaderUserId) {
      await db.prepare(`
        INSERT INTO department_members (department_id, guild_id, user_id, role, status, requested_at, reviewed_by, reviewed_at)
        VALUES (?, ?, ?, 'leader', 'approved', datetime('now'), ?, datetime('now'))
      `).run(deptId, guild.id, body.leaderUserId, user.id);
    }

    // Si adjoint désigné, enregistrer dans department_members
    if (body.deputyUserId) {
      await db.prepare(`
        INSERT INTO department_members (department_id, guild_id, user_id, role, status, requested_at, reviewed_by, reviewed_at)
        VALUES (?, ?, ?, 'deputy', 'approved', datetime('now'), ?, datetime('now'))
      `).run(deptId, guild.id, body.deputyUserId, user.id);
    }

    // 5. Persistance dans config/guilds/{guildId}.json
    try {
      addDepartmentToConfig(guild.id, {
        id: deptId,
        name: body.name,
        shortName: body.shortName,
        icon: body.icon,
        color: body.color,
        description: body.description,
        leaderRoleId: leaderRole?.id || null,
        deputyRoleId: deputyRole?.id || null,
        memberRoleId: memberRole?.id || null,
        categoryId: category?.id || null,
        categoryName: category?.name,
        channels: createdChannelsList
      });
    } catch {}

    recordAudit(guild.id, user.id, user.username, 'DEPARTMENT_CREATED', deptId, `Pôle "${body.name}" créé avec succès`);

    res.status(201).json({
      success: true,
      message: `Pôle "${body.name}" créé avec succès !`,
      data: {
        id: deptId,
        name: body.name,
        leaderRoleId: leaderRole?.id,
        deputyRoleId: deputyRole?.id,
        memberRoleId: memberRole?.id,
        categoryId: category?.id
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/guilds/:guildId/departments/:deptId
 * Archive les salons dans une catégorie d'archives et clôture le pôle
 */
departmentsRouter.delete('/:deptId', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ success: false, error: 'Serveur introuvable.' });

  const dept = (await db.prepare('SELECT * FROM departments WHERE id = ? AND guild_id = ?').get(req.params.deptId, guild.id)) as any;
  if (!dept) return res.status(404).json({ success: false, error: 'Pôle introuvable.' });

  const user = req.session.user!;

  try {
    // 1. Archiver les salons Discord
    if (dept.category_id) {
      // Trouver ou créer la catégorie d'archive
      const channels = await guild.channels.fetch();
      let archiveCategory = channels.find(c => c && c.type === ChannelType.GuildCategory && c.name.includes('ARCHIVES'));
      if (!archiveCategory) {
        archiveCategory = await guild.channels.create({
          name: '🗄️ ARCHIVES CORTEX',
          type: ChannelType.GuildCategory,
          reason: 'Cortex : Catégorie d\'archivage des pôles supprimés'
        });
      }

      // Déplacer les salons enfants de la catégorie du département vers l'archive et verrouiller
      const childChannels = channels.filter(c => c && c.parentId === dept.category_id);
      for (const [, child] of childChannels) {
        if (!child) continue;
        await child.setParent(archiveCategory.id, { lockPermissions: false }).catch(() => null);
        if ('permissionOverwrites' in child) {
          await (child as TextChannel).permissionOverwrites.edit(guild.id, {
            SendMessages: false
          }).catch(() => null);
        }
      }

      // Supprimer l'ancienne catégorie désormais vide
      const oldCat = await guild.channels.fetch(dept.category_id).catch(() => null);
      if (oldCat) await oldCat.delete('Cortex : Pôle archivé').catch(() => null);
    }

    // 2. Marquer comme archivé en base de données
    await db.prepare('UPDATE departments SET is_archived = true, updated_at = datetime(\'now\') WHERE id = ?').run(dept.id);

    // 3. Mettre à jour le fichier JSON déclaratif
    try {
      removeDepartmentFromConfig(guild.id, dept.id);
    } catch {}

    recordAudit(guild.id, user.id, user.username, 'DEPARTMENT_ARCHIVED', dept.id, `Pôle "${dept.name}" archivé`);

    res.json({
      success: true,
      message: `Pôle "${dept.name}" archivé avec succès. Les salons ont été déplacés dans la catégorie d'archives.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/guilds/:guildId/departments/:deptId/members
 * Liste des membres et demandes d'adhésion en attente
 */
departmentsRouter.get('/:deptId/members', requireAuth, async (req: Request, res: Response) => {
  const guild = discordClient.guilds.cache.get(req.params.guildId);
  const dept = (await db.prepare('SELECT * FROM departments WHERE id = ? AND guild_id = ?').get(req.params.deptId, req.params.guildId)) as any;
  if (!dept) return res.status(404).json({ success: false, error: 'Pôle introuvable.' });

  try {
    // 1. Synchronisation automatique en direct si le serveur Discord est accessible
    if (guild) {
      try {
        if (dept.leader_role_id) {
          const leaderRole = guild.roles.cache.get(dept.leader_role_id);
          if (leaderRole) {
            for (const [mId, m] of leaderRole.members) {
              await db.prepare(`
                INSERT INTO department_members (department_id, guild_id, user_id, role, status, requested_at, reviewed_at)
                VALUES (?, ?, ?, 'leader', 'approved', datetime('now'), datetime('now'))
                ON CONFLICT(department_id, user_id) DO UPDATE SET role = 'leader', status = 'approved'
              `).run(dept.id, req.params.guildId, mId);

              await db.prepare(`
                INSERT INTO users (id, username, discriminator, avatar)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar
              `).run(mId, m.user.username, m.user.discriminator || '0', m.user.avatar || null);
            }
          }
        }

        if (dept.deputy_role_id) {
          const deputyRole = guild.roles.cache.get(dept.deputy_role_id);
          if (deputyRole) {
            for (const [mId, m] of deputyRole.members) {
              await db.prepare(`
                INSERT INTO department_members (department_id, guild_id, user_id, role, status, requested_at, reviewed_at)
                VALUES (?, ?, ?, 'deputy', 'approved', datetime('now'), datetime('now'))
                ON CONFLICT(department_id, user_id) DO UPDATE SET 
                  role = CASE WHEN department_members.role = 'leader' THEN 'leader' ELSE 'deputy' END,
                  status = 'approved'
              `).run(dept.id, req.params.guildId, mId);

              await db.prepare(`
                INSERT INTO users (id, username, discriminator, avatar)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar
              `).run(mId, m.user.username, m.user.discriminator || '0', m.user.avatar || null);
            }
          }
        }

        if (dept.member_role_id) {
          const memberRole = guild.roles.cache.get(dept.member_role_id);
          if (memberRole) {
            for (const [mId, m] of memberRole.members) {
              await db.prepare(`
                INSERT INTO department_members (department_id, guild_id, user_id, role, status, requested_at, reviewed_at)
                VALUES (?, ?, ?, 'member', 'approved', datetime('now'), datetime('now'))
                ON CONFLICT(department_id, user_id) DO NOTHING
              `).run(dept.id, req.params.guildId, mId);

              await db.prepare(`
                INSERT INTO users (id, username, discriminator, avatar)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar
              `).run(mId, m.user.username, m.user.discriminator || '0', m.user.avatar || null);
            }
          }
        }
      } catch {}
    }

    const records = (await db.prepare(`
      SELECT dm.*, u.username, u.avatar
      FROM department_members dm
      LEFT JOIN users u ON u.id = dm.user_id
      WHERE dm.department_id = ?
      ORDER BY dm.requested_at DESC
    `).all(dept.id)) as any[];

    // Récupérer les pseudos Discord si possible
    const enriched = await Promise.all(records.map(async (r) => {
      let displayName = r.username || r.user_id;
      let avatarUrl = null;

      if (guild) {
        const mem = await guild.members.fetch(r.user_id).catch(() => null);
        if (mem) {
          displayName = mem.displayName;
          avatarUrl = mem.user.displayAvatarURL();
        }
      }

      return {
        userId: r.user_id,
        displayName,
        username: r.username,
        avatarUrl,
        role: r.role,
        status: r.status,
        motivation: r.motivation || null,
        skills: r.skills || null,
        availability: r.availability || null,
        requestedAt: r.requested_at,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at
      };
    }));

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/departments/:deptId/join
 * Demande d'adhésion à un pôle (mise en attente de validation)
 */
departmentsRouter.post('/:deptId/join', requireAuth, async (req: Request, res: Response) => {
  const user = req.session.user!;
  const guildId = req.params.guildId;
  const dept = (await db.prepare('SELECT * FROM departments WHERE id = ? AND guild_id = ?').get(req.params.deptId, guildId)) as any;
  if (!dept) return res.status(404).json({ success: false, error: 'Pôle introuvable.' });

  const existing = (await db.prepare('SELECT * FROM department_members WHERE department_id = ? AND user_id = ?').get(dept.id, user.id)) as any;
  if (existing) {
    if (existing.status === 'approved') return res.status(400).json({ success: false, error: 'Vous êtes déjà membre de ce pôle.' });
    if (existing.status === 'pending') return res.status(400).json({ success: false, error: 'Votre candidature est déjà en cours d\'examen.' });
  }

  await db.prepare(`
    INSERT INTO department_members (department_id, guild_id, user_id, role, status, requested_at)
    VALUES (?, ?, ?, 'member', 'pending', datetime('now'))
    ON CONFLICT(department_id, user_id) DO UPDATE SET
      status = 'pending',
      requested_at = datetime('now')
  `).run(dept.id, guildId, user.id);

  res.json({ success: true, message: `Votre demande pour rejoindre le pôle "${dept.name}" a été soumise au responsable.` });
});

/**
 * POST /api/guilds/:guildId/departments/:deptId/members/:userId/review
 * Approbation ou refus d'une adhésion par le chef de pôle ou un administrateur
 */
departmentsRouter.post('/:deptId/members/:userId/review', requireAuth, requireGuildAdmin, validateBody(ReviewDepartmentMemberSchema), async (req: Request, res: Response) => {
  const { deptId, userId, guildId } = req.params;
  const dept = (await db.prepare('SELECT * FROM departments WHERE id = ? AND guild_id = ?').get(deptId, guildId)) as any;
  if (!dept) return res.status(404).json({ success: false, error: 'Pôle introuvable.' });

  const reviewer = req.session.user!;
  const { action } = req.body;
  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  await db.prepare(`
    UPDATE department_members
    SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
    WHERE department_id = ? AND user_id = ?
  `).run(newStatus, reviewer.id, dept.id, userId);

  // Si approuvé, attribuer le rôle Discord
  if (action === 'approve' && dept.member_role_id) {
    const guild = discordClient.guilds.cache.get(guildId);
    if (guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        await member.roles.add(dept.member_role_id, `Cortex : Adhésion au pôle ${dept.name} validée par ${reviewer.username}`).catch(() => null);
      }
    }
  }

  recordAudit(guildId, reviewer.id, reviewer.username, 'DEPARTMENT_MEMBER_REVIEWED', userId, `${action === 'approve' ? 'Approbation' : 'Refus'} d'adhésion au pôle "${dept.name}" pour ${userId}`);

  res.json({
    success: true,
    message: action === 'approve' ? 'Adhésion validée et rôle Discord attribué !' : 'Candidature refusée.'
  });
});

/**
 * POST /api/guilds/:guildId/departments/send-panel
 * Envoie un message interactif (Embed + Menu déroulant + Boutons) dans le salon choisi
 * pour permettre aux membres de postuler à un pôle via un formulaire modal.
 */
departmentsRouter.post('/send-panel', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  const { channelId, title, description } = req.body;

  if (!channelId) {
    return res.status(400).json({ success: false, error: 'Identifiant du salon requis.' });
  }

  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) {
    return res.status(404).json({ success: false, error: 'Serveur Discord introuvable ou le bot n\'est pas connecté.' });
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return res.status(400).json({ success: false, error: 'Le salon spécifié n\'existe pas ou n\'est pas un salon textuel valide.' });
  }

  const botMember = await guild.members.fetchMe();
  if (!channel.permissionsFor(botMember)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    return res.status(403).json({ success: false, error: 'Le bot n\'a pas la permission d\'envoyer des messages et des embeds dans ce salon.' });
  }

  const departments = (await db.prepare(`
    SELECT * FROM departments 
    WHERE guild_id = ? AND is_archived = 0
    ORDER BY created_at ASC
  `).all(guildId)) as any[];

  if (departments.length === 0) {
    return res.status(400).json({ success: false, error: 'Aucun pôle scientifique actif n\'a encore été configuré sur ce serveur.' });
  }

  const embed = new EmbedBuilder()
    .setTitle(title || '🔴 CORTEX SCIENTIFIC CLUB — PÔLES & CANDIDATURES')
    .setColor(0xE5092E)
    .setDescription(
      description ||
      '🔬 **Rejoignez un Pôle de Recherche & d\'Innovation Scientifique !**\n\n' +
      'Les départements de CORTEX vous permettent de collaborer sur des projets concrets, de participer à des hackathons et compétitions et d\'accéder à du mentorat avancé.\n\n' +
      '**📋 Pôles actuellement ouverts :**\n' +
      departments.map(d => `• **${d.icon || '🔬'} ${d.name}**\n  *${d.description || 'Pôle scientifique actif.'}*`).join('\n\n') +
      '\n\n👉 **Pour postuler :** Cliquez sur le bouton ou choisissez votre pôle dans le menu déroulant ci-dessous pour ouvrir le formulaire de candidature.'
    )
    .setFooter({ text: 'CORTEX Scientific Club • Vos réponses seront examinées par les responsables' })
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('cortex_dept_select')
    .setPlaceholder('🎯 Sélectionnez votre pôle pour postuler...')
    .addOptions(
      departments.slice(0, 25).map(d => ({
        label: d.name.slice(0, 100),
        value: d.id,
        description: (d.description || 'Candidater à ce pôle').slice(0, 100),
        emoji: d.icon || '🔬'
      }))
    );

  const rows: ActionRowBuilder<any>[] = [
    new ActionRowBuilder().addComponents(selectMenu)
  ];

  if (departments.length <= 5) {
    const buttonRow = new ActionRowBuilder().addComponents(
      departments.map(d =>
        new ButtonBuilder()
          .setCustomId(`cortex_dept_btn_${d.id}`)
          .setLabel(d.short_name || d.name)
          .setEmoji(d.icon || '🔬')
          .setStyle(ButtonStyle.Secondary)
      )
    );
    rows.push(buttonRow);
  }

  await (channel as TextChannel).send({
    embeds: [embed],
    components: rows
  });

  const user = req.session.user!;
  recordAudit(guildId, user.id, user.username, 'DEPARTMENT_PANEL_SENT', channelId, `Panneau de recrutement envoyé dans #${channel.name}`);

  res.json({
    success: true,
    message: `Le panneau de candidature aux pôles a été envoyé avec succès dans #${channel.name} !`
  });
});
