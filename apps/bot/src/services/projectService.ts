import { randomUUID } from 'crypto';
import {
  Guild,
  ChannelType,
  PermissionFlagsBits,
  TextChannel
} from 'discord.js';
import {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectRecord,
  sanitizeChannelName
} from '@sciclub/shared';
import { db } from '../database/db.js';
import { AuditLogService } from './auditLogService.js';
import { PointsService } from './pointsService.js';
import { ConfigService } from './configService.js';

export class ProjectService {
  /**
   * Crée un nouveau projet scientifique et son salon dédié restreint
   */
  static async createProject(
    guild: Guild,
    input: CreateProjectInput,
    operator: { id: string; username: string }
  ): Promise<ProjectRecord> {
    const projectId = randomUUID();
    let channelId: string | null = null;

    // Création facultative du salon Discord dédié
    if (input.createChannel) {
      try {
        const botMember = await guild.members.fetchMe();
        if (botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
          // Cherche la catégorie 'projets' depuis la config
          const config = ConfigService.getGuildConfig(guild.id);
          const projectCatKey = config?.categories?.find(c => c.key === 'projets')?.key;
          let parentCategoryId: string | undefined = undefined;

          if (projectCatKey) {
            const cat = guild.channels.cache.find(
              c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('projet')
            );
            if (cat) parentCategoryId = cat.id;
          }

          const channelName = sanitizeChannelName(`prj-${input.name}`);
          const createdChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: parentCategoryId,
            topic: `🚀 Projet Scientifique : ${input.name} - ${input.description.slice(0, 500)}`,
            permissionOverwrites: [
              // Refus par défaut pour tout le monde
              {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
              },
              // Accès accordé au bot
              {
                id: botMember.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.EmbedLinks
                ]
              },
              // Accès accordé au chef de projet
              {
                id: input.leaderId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.EmbedLinks
                ]
              }
            ],
            reason: `Création du projet scientifique "${input.name}"`
          });

          // Ajout de chaque membre du projet dans les permissions du salon
          for (const memberId of input.memberIds) {
            if (memberId !== input.leaderId) {
              await createdChannel.permissionOverwrites.edit(memberId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true
              }).catch(() => null);
            }
          }

          channelId = createdChannel.id;
        }
      } catch (err) {
        // En cas d'erreur de salon, on continue la création du projet en base
      }
    }

    // Enregistrement en base de données
    const insertProject = db.prepare(`
      INSERT INTO projects (id, guild_id, name, description, leader_id, channel_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'idea', datetime('now'), datetime('now'))
    `);
    await insertProject.run(projectId, guild.id, input.name, input.description, input.leaderId, channelId);

    // Enregistrement du chef comme membre leader
    const insertMember = db.prepare(`
      INSERT INTO project_members (project_id, user_id, role, joined_at)
      VALUES (?, ?, 'leader', datetime('now'))
    `);
    await insertMember.run(projectId, input.leaderId);

    // Enregistrement des autres membres
    const insertContrib = db.prepare(`
      INSERT OR IGNORE INTO project_members (project_id, user_id, role, joined_at)
      VALUES (?, ?, 'contributor', datetime('now'))
    `);
    for (const mId of input.memberIds) {
      if (mId !== input.leaderId) {
        await insertContrib.run(projectId, mId);
      }
    }

    // Récompense en points pour la création de projet
    const config = ConfigService.getGuildConfig(guild.id);
    const pts = config?.points?.projectCreationPoints ?? 20;
    if (config?.points?.enabled) {
      await PointsService.addPoints(guild.id, input.leaderId, pts);
    }

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'PROJECT_CREATED',
      targetType: 'project',
      targetId: projectId,
      details: `Projet "${input.name}" créé avec succès (Leader: ${input.leaderId})`
    });

    return {
      id: projectId,
      guildId: guild.id,
      name: input.name,
      description: input.description,
      leaderId: input.leaderId,
      channelId,
      status: 'idea',
      memberIds: [input.leaderId, ...input.memberIds.filter(m => m !== input.leaderId)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Met à jour le statut ou les informations d'un projet
   */
  static async updateProject(
    guild: Guild,
    projectId: string,
    input: UpdateProjectInput,
    operator: { id: string; username: string }
  ): Promise<void> {
    const project = (await db.prepare('SELECT * FROM projects WHERE id = ? AND guild_id = ?').get(projectId, guild.id)) as any;
    if (!project) throw new Error('Projet introuvable.');

    const updates: string[] = [];
    const params: any[] = [];

    if (input.name) {
      updates.push('name = ?');
      params.push(input.name);
    }
    if (input.description) {
      updates.push('description = ?');
      params.push(input.description);
    }
    if (input.leaderId) {
      updates.push('leader_id = ?');
      params.push(input.leaderId);
    }
    if (input.status) {
      updates.push('status = ?');
      params.push(input.status);

      // Si le statut passe à 'archived', verrouiller le salon dédié si demandé
      if (input.status === 'archived' && project.channel_id && input.archiveChannel !== false) {
        const channel = await guild.channels.fetch(project.channel_id).catch(() => null);
        if (channel && channel.isTextBased()) {
          await (channel as TextChannel).permissionOverwrites.edit(guild.id, {
            SendMessages: false
          }).catch(() => null);
        }
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(projectId, guild.id);
      await db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND guild_id = ?`).run(...params);
    }

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'PROJECT_UPDATED',
      targetType: 'project',
      targetId: projectId,
      details: `Projet "${project.name}" mis à jour (${input.status || 'infos'})`
    });
  }

  /**
   * Retourne tous les projets d'un serveur
   */
  static async getProjects(guildId: string): Promise<ProjectRecord[]> {
    const projects = (await db.prepare(`
      SELECT 
        id,
        guild_id as guildId,
        name,
        description,
        leader_id as leaderId,
        channel_id as channelId,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      FROM projects
      WHERE guild_id = ?
      ORDER BY created_at DESC
    `).all(guildId)) as unknown as ProjectRecord[];

    return await Promise.all(projects.map(async p => {
      const memberRows = (await db.prepare('SELECT user_id FROM project_members WHERE project_id = ?').all(p.id)) as unknown as { user_id: string }[];
      return {
        ...p,
        memberIds: memberRows.map(m => m.user_id)
      };
    }));
  }
}
