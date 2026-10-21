import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { discordClient } from '../botClient.js';
import { db } from '../db.js';
import {
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} from 'discord.js';

export const candidaturesRouter = Router({ mergeParams: true });

/**
 * GET /api/guilds/:guildId/candidatures/config
 * Récupère la configuration du recrutement club
 */
candidaturesRouter.get('/config', requireAuth, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  try {
    const config = (await db.prepare('SELECT * FROM candidature_configs WHERE guild_id = ?').get(guildId)) as any;
    const guild = discordClient.guilds.cache.get(guildId);

    let submissionChannelName = null;
    let reviewChannelName = null;
    let memberRoleName = null;

    if (guild && config) {
      if (config.submission_channel_id) {
        submissionChannelName = guild.channels.cache.get(config.submission_channel_id)?.name || null;
      }
      if (config.review_channel_id) {
        reviewChannelName = guild.channels.cache.get(config.review_channel_id)?.name || null;
      }
      if (config.member_role_id) {
        memberRoleName = guild.roles.cache.get(config.member_role_id)?.name || null;
      }
    }

    res.json({
      success: true,
      data: {
        guildId,
        submissionChannelId: config?.submission_channel_id || null,
        submissionChannelName,
        reviewChannelId: config?.review_channel_id || null,
        reviewChannelName,
        memberRoleId: config?.member_role_id || null,
        memberRoleName,
        panelMessageId: config?.panel_message_id || null,
        title: config?.title || '🔴 CORTEX SCIENTIFIC CLUB — RECRUTEMENT OFFICIEL',
        description: config?.description || 'Rejoignez le premier club scientifique d\'innovation, d\'ingénierie et de recherche ! Cliquez sur le bouton ci-dessous pour déposer votre candidature officielle.',
        updatedAt: config?.updated_at || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/guilds/:guildId/candidatures/panels
 * Liste des panneaux de recrutement club actifs sur Discord
 */
candidaturesRouter.get('/panels', requireAuth, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  try {
    const panels = (await db.prepare(`
      SELECT * FROM candidature_panels 
      WHERE guild_id = ? 
      ORDER BY created_at DESC
    `).all(guildId)) as any[];

    const guild = discordClient.guilds.cache.get(guildId);
    const enriched = panels.map(p => {
      let channelName = p.channel_id;
      if (guild) {
        const ch = guild.channels.cache.get(p.channel_id);
        if (ch) channelName = ch.name;
      }
      return {
        id: p.id,
        guildId: p.guild_id,
        channelId: p.channel_id,
        channelName,
        messageId: p.message_id,
        title: p.title,
        description: p.description,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/guilds/:guildId/candidatures/panels/:panelId
 * Supprime un panneau de recrutement club de Discord et de la base
 */
candidaturesRouter.delete('/panels/:panelId', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId, panelId } = req.params;
  try {
    const panel = (await db.prepare('SELECT * FROM candidature_panels WHERE id = ? AND guild_id = ?').get(panelId, guildId)) as any;
    if (!panel) return res.status(404).json({ success: false, error: 'Panneau introuvable.' });

    const guild = discordClient.guilds.cache.get(guildId);
    if (guild) {
      const channel = await guild.channels.fetch(panel.channel_id).catch(() => null);
      if (channel && channel.isTextBased()) {
        const msg = await (channel as TextChannel).messages.fetch(panel.message_id).catch(() => null);
        if (msg) await msg.delete().catch(() => null);
      }
    }

    await db.prepare('DELETE FROM candidature_panels WHERE id = ?').run(panelId);
    res.json({ success: true, message: 'Panneau de recrutement supprimé avec succès.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/candidatures/send-panel
 * Déploie le panneau de recrutement d'adhésion au club sur Discord
 */
candidaturesRouter.post('/send-panel', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  const { submissionChannelId, reviewChannelId, memberRoleId, title, description } = req.body;

  if (!submissionChannelId || !reviewChannelId) {
    return res.status(400).json({
      success: false,
      error: 'Veuillez spécifier le salon d\'envoi ET le salon de réception des candidatures.'
    });
  }

  const guild = discordClient.guilds.cache.get(guildId) || await discordClient.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    return res.status(404).json({ success: false, error: 'Serveur Discord introuvable ou bot déconnecté.' });
  }

  const subChannel = await guild.channels.fetch(submissionChannelId).catch(() => null);
  if (!subChannel || !subChannel.isTextBased()) {
    return res.status(400).json({ success: false, error: 'Le salon d\'envoi spécifié est invalide.' });
  }

  const revChannel = await guild.channels.fetch(reviewChannelId).catch(() => null);
  if (!revChannel || !revChannel.isTextBased()) {
    return res.status(400).json({ success: false, error: 'Le salon de réception spécifié est invalide.' });
  }

  const botMember = await guild.members.fetchMe();
  if (!subChannel.permissionsFor(botMember)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    return res.status(403).json({ success: false, error: 'Le bot n\'a pas les permissions requises dans le salon d\'envoi.' });
  }

  const panelTitle = title || '🔴 CORTEX SCIENTIFIC CLUB — RECRUTEMENT OFFICIEL';
  const panelDesc = description ||
    '🔬 **Rejoignez l\'aventure scientifique et technique CORTEX !**\n\n' +
    'En intégrant CORTEX, vous participez à des projets d\'envergure (IA, Robotique, Aérospatial, Électronique, Dév), des hackathons et des ateliers de recherche avancée.\n\n' +
    '👉 **Pour postuler :** Cliquez sur le bouton ci-dessous pour ouvrir le formulaire de candidature officiel.\n\n' +
    '*(Votre candidature sera transmise au bureau et examinée sous 24 à 48 heures)*';

  const embed = new EmbedBuilder()
    .setTitle(panelTitle)
    .setColor(0xE5092E)
    .setDescription(panelDesc)
    .setFooter({ text: 'CORTEX Scientific Club • Recrutements ouverts' })
    .setTimestamp();

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('cortex_cand_btn')
      .setLabel('Déposer une candidature')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Success)
  );

  const sentMessage = await (subChannel as TextChannel).send({
    embeds: [embed],
    components: [buttonRow]
  });

  // Sauvegarder dans candidature_configs
  await db.prepare(`
    INSERT INTO candidature_configs (
      guild_id, submission_channel_id, review_channel_id, panel_message_id, member_role_id, title, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(guild_id) DO UPDATE SET
      submission_channel_id = excluded.submission_channel_id,
      review_channel_id = excluded.review_channel_id,
      panel_message_id = excluded.panel_message_id,
      member_role_id = excluded.member_role_id,
      title = excluded.title,
      description = excluded.description,
      updated_at = datetime('now')
  `).run(guildId, submissionChannelId, reviewChannelId, sentMessage.id, memberRoleId || null, panelTitle, panelDesc);

  // Sauvegarder dans candidature_panels
  const panelId = `cand_panel_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  await db.prepare(`
    INSERT INTO candidature_panels (id, guild_id, channel_id, message_id, title, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(panelId, guildId, submissionChannelId, sentMessage.id, panelTitle, panelDesc);

  res.json({
    success: true,
    message: `Panneau de candidature déployé avec succès dans #${subChannel.name} ! Les candidatures arriveront dans #${revChannel.name}.`,
    data: {
      panelId,
      messageId: sentMessage.id,
      submissionChannelId,
      reviewChannelId
    }
  });
});

/**
 * GET /api/guilds/:guildId/candidatures
 * Liste des candidatures avec données membres et filtres
 */
candidaturesRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  const { status } = req.query;

  try {
    let query = `
      SELECT c.*, u.username, u.discriminator, u.avatar
      FROM candidatures c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.guild_id = ?
    `;
    const params: any[] = [guildId];

    if (status && status !== 'all') {
      query += ' AND c.status = ?';
      params.push(status);
    }

    query += ' ORDER BY c.created_at DESC';

    const candidatures = (await db.prepare(query).all(...params)) as any[];
    const guild = discordClient.guilds.cache.get(guildId);

    const enriched = await Promise.all(candidatures.map(async (c) => {
      let displayName = c.username || c.user_id;
      let avatarUrl = c.avatar ? `https://cdn.discordapp.com/avatars/${c.user_id}/${c.avatar}.png` : null;

      if (guild) {
        const mem = await guild.members.fetch(c.user_id).catch(() => null);
        if (mem) {
          displayName = mem.displayName;
          avatarUrl = mem.user.displayAvatarURL();
        }
      }

      return {
        id: c.id,
        guildId: c.guild_id,
        userId: c.user_id,
        username: c.username,
        displayName,
        avatarUrl,
        studyField: c.study_field,
        motivation: c.motivation,
        interests: c.interests,
        availability: c.availability,
        status: c.status,
        discordMessageId: c.discord_message_id,
        reviewNotes: c.review_notes,
        reviewedBy: c.reviewed_by,
        reviewedAt: c.reviewed_at,
        createdAt: c.created_at
      };
    }));

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/candidatures/:id/review
 * Approbation ou refus d'une candidature au club depuis le Dashboard Web
 */
candidaturesRouter.post('/:id/review', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId, id } = req.params;
  const { action, reviewNotes } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Action invalide (doit être approve ou reject).' });
  }

  const cand = (await db.prepare('SELECT * FROM candidatures WHERE id = ? AND guild_id = ?').get(id, guildId)) as any;
  if (!cand) return res.status(404).json({ success: false, error: 'Candidature introuvable.' });

  const reviewer = req.session.user!;
  const newStatus = action === 'approve' ? 'accepted' : 'rejected';

  await db.prepare(`
    UPDATE candidatures
    SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, reviewNotes || null, reviewer.id, id);

  const guild = discordClient.guilds.cache.get(guildId);
  const config = (await db.prepare('SELECT * FROM candidature_configs WHERE guild_id = ?').get(guildId)) as any;

  // Si approuvé, attribuer le rôle Discord
  if (guild && action === 'approve') {
    let memberRoleId = config?.member_role_id;
    if (!memberRoleId) {
      const foundRole = guild.roles.cache.find(r =>
        r.name.toLowerCase().includes('membre officiel') ||
        r.name.toLowerCase().includes('membre cortex') ||
        r.name.toLowerCase() === 'membre'
      );
      if (foundRole) memberRoleId = foundRole.id;
    }

    const candidateMember = await guild.members.fetch(cand.user_id).catch(() => null);
    if (candidateMember) {
      if (memberRoleId) {
        await candidateMember.roles.add(memberRoleId, `Cortex : Candidature validée par ${reviewer.username}`).catch(() => null);
      }
      await candidateMember.send({
        content: `🎉 Félicitations ! Votre candidature d'adhésion officielle à **CORTEX Scientific Club** a été **validée** par ${reviewer.username} ! Bienvenue parmi nous !`
      }).catch(() => null);
    }
  } else if (guild && action === 'reject') {
    const candidateMember = await guild.members.fetch(cand.user_id).catch(() => null);
    if (candidateMember) {
      await candidateMember.send({
        content: `ℹ️ Bonjour <@${cand.user_id}>,\n\nVotre candidature pour rejoindre **CORTEX Scientific Club** a été examinée par les responsables.\n\nMalheureusement, elle n'a pas pu être retenue pour cette session. Nous vous remercions chaleureusement pour votre démarche et votre intérêt envers notre club !`
      }).catch(() => null);
    }
  }

  // Mettre à jour le message Discord dans le salon staff si disponible
  if (guild && config?.review_channel_id && cand.discord_message_id) {
    try {
      const revChannel = await guild.channels.fetch(config.review_channel_id).catch(() => null);
      if (revChannel && revChannel.isTextBased()) {
        const msg = await (revChannel as TextChannel).messages.fetch(cand.discord_message_id).catch(() => null);
        if (msg && msg.embeds.length > 0) {
          const updatedEmbed = EmbedBuilder.from(msg.embeds[0])
            .setColor(action === 'approve' ? 0x10B981 : 0xEF4444)
            .addFields({
              name: action === 'approve' ? '✅ Décision : Acceptée (via Dashboard)' : '❌ Décision : Refusée (via Dashboard)',
              value: `Traité par **${reviewer.username}** le <t:${Math.floor(Date.now() / 1000)}:R>`
            });

          await msg.edit({
            embeds: [updatedEmbed],
            components: []
          });
        }
      }
    } catch {}
  }

  res.json({
    success: true,
    message: action === 'approve' ? 'Candidature validée et rôle attribué avec succès !' : 'Candidature refusée.'
  });
});
