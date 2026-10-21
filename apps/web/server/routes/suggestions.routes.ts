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

export const suggestionsRouter = Router({ mergeParams: true });

/**
 * GET /api/guilds/:guildId/suggestions/config
 * Récupère la configuration des salons de suggestions
 */
suggestionsRouter.get('/config', requireAuth, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  try {
    const config = (await db.prepare('SELECT * FROM suggestion_configs WHERE guild_id = ?').get(guildId)) as any;
    const guild = discordClient.guilds.cache.get(guildId);

    let submissionChannelName = null;
    let reviewChannelName = null;

    if (guild && config) {
      if (config.submission_channel_id) {
        submissionChannelName = guild.channels.cache.get(config.submission_channel_id)?.name || null;
      }
      if (config.review_channel_id) {
        reviewChannelName = guild.channels.cache.get(config.review_channel_id)?.name || null;
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
        panelMessageId: config?.panel_message_id || null,
        title: config?.title || '💡 CORTEX SCIENTIFIC CLUB — BOÎTE À IDÉES & SUGGESTIONS',
        description: config?.description || 'Une idée d\'atelier, de projet de recherche, d\'invité ou d\'amélioration pour le club ? Cliquez ci-dessous pour soumettre votre proposition !',
        updatedAt: config?.updated_at || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/suggestions/send-panel
 * Déploie le panneau de suggestion dans le salon d'envoi et configure le salon de réception
 */
suggestionsRouter.post('/send-panel', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  const { submissionChannelId, reviewChannelId, title, description } = req.body;

  if (!submissionChannelId || !reviewChannelId) {
    return res.status(400).json({
      success: false,
      error: 'Veuillez spécifier le salon d\'envoi ET le salon de réception des suggestions.'
    });
  }

  const guild = discordClient.guilds.cache.get(guildId) || await discordClient.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    return res.status(404).json({ success: false, error: 'Serveur Discord introuvable ou le bot n\'est pas connecté.' });
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

  const panelTitle = title || '💡 CORTEX SCIENTIFIC CLUB — BOÎTE À IDÉES & SUGGESTIONS';
  const panelDesc = description ||
    '🔬 **Votre avis et vos initiatives comptent pour CORTEX !**\n\n' +
    'Vous avez une idée d\'atelier pratique, un thème de conférence, un projet innovant, une proposition de partenariat ou une amélioration pour le club ?\n\n' +
    '👉 **Cliquez sur le bouton ci-dessous** pour ouvrir le formulaire et soumettre votre idée en direct aux responsables.\n\n' +
    '*(Votre suggestion sera examinée et soumise aux votes dans le salon staff dédié)*';

  const embed = new EmbedBuilder()
    .setTitle(panelTitle)
    .setColor(0x3B82F6) // Bleu CORTEX
    .setDescription(panelDesc)
    .setFooter({ text: 'CORTEX Scientific Club • Boîte à suggestions active' })
    .setTimestamp();

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('cortex_suggestion_btn')
      .setLabel('Proposer une suggestion / idée')
      .setEmoji('💡')
      .setStyle(ButtonStyle.Primary)
  );

  const sentMessage = await (subChannel as TextChannel).send({
    embeds: [embed],
    components: [buttonRow]
  });

  // Sauvegarder dans suggestion_configs
  await db.prepare(`
    INSERT INTO suggestion_configs (
      guild_id, submission_channel_id, review_channel_id, panel_message_id, title, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(guild_id) DO UPDATE SET
      submission_channel_id = excluded.submission_channel_id,
      review_channel_id = excluded.review_channel_id,
      panel_message_id = excluded.panel_message_id,
      title = excluded.title,
      description = excluded.description,
      updated_at = datetime('now')
  `).run(guildId, submissionChannelId, reviewChannelId, sentMessage.id, panelTitle, panelDesc);

  res.json({
    success: true,
    message: `Panneau de suggestion envoyé avec succès dans #${subChannel.name} ! Les suggestions arriveront dans #${revChannel.name}.`,
    data: {
      messageId: sentMessage.id,
      submissionChannelId,
      reviewChannelId
    }
  });
});

/**
 * GET /api/guilds/:guildId/suggestions
 * Liste des suggestions soumises avec données utilisateur
 */
suggestionsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const { guildId } = req.params;
  const { status } = req.query;

  try {
    let query = `
      SELECT s.*, u.username, u.discriminator, u.avatar
      FROM suggestions s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.guild_id = ?
    `;
    const params: any[] = [guildId];

    if (status && status !== 'all') {
      query += ' AND s.status = ?';
      params.push(status);
    }

    query += ' ORDER BY s.created_at DESC';

    const suggestions = (await db.prepare(query).all(...params)) as any[];
    const guild = discordClient.guilds.cache.get(guildId);

    const enriched = await Promise.all(suggestions.map(async (s) => {
      let displayName = s.username || s.user_id;
      let avatarUrl = s.avatar ? `https://cdn.discordapp.com/avatars/${s.user_id}/${s.avatar}.png` : null;

      if (guild) {
        const mem = await guild.members.fetch(s.user_id).catch(() => null);
        if (mem) {
          displayName = mem.displayName;
          avatarUrl = mem.user.displayAvatarURL();
        }
      }

      return {
        id: s.id,
        guildId: s.guild_id,
        userId: s.user_id,
        username: s.username,
        displayName,
        avatarUrl,
        title: s.title,
        description: s.description,
        benefits: s.benefits,
        status: s.status,
        discordMessageId: s.discord_message_id,
        reviewNotes: s.review_notes,
        reviewedBy: s.reviewed_by,
        reviewedAt: s.reviewed_at,
        createdAt: s.created_at
      };
    }));

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/guilds/:guildId/suggestions/:id/review
 * Traite une suggestion depuis le Dashboard Web
 */
suggestionsRouter.post('/:id/review', requireAuth, requireGuildAdmin, async (req: Request, res: Response) => {
  const { guildId, id } = req.params;
  const { status, reviewNotes } = req.body;

  if (!['approved', 'in_discussion', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Statut de révision invalide.' });
  }

  const sug = (await db.prepare('SELECT * FROM suggestions WHERE id = ? AND guild_id = ?').get(id, guildId)) as any;
  if (!sug) return res.status(404).json({ success: false, error: 'Suggestion introuvable.' });

  const reviewer = req.session.user!;

  await db.prepare(`
    UPDATE suggestions
    SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).run(status, reviewNotes || null, reviewer.id, id);

  // Mettre à jour l'embed Discord dans le salon de réception si le message existe
  try {
    const config = (await db.prepare('SELECT * FROM suggestion_configs WHERE guild_id = ?').get(guildId)) as any;
    const guild = discordClient.guilds.cache.get(guildId);

    if (guild && config?.review_channel_id && sug.discord_message_id) {
      const revChannel = await guild.channels.fetch(config.review_channel_id).catch(() => null);
      if (revChannel && revChannel.isTextBased()) {
        const msg = await (revChannel as TextChannel).messages.fetch(sug.discord_message_id).catch(() => null);
        if (msg && msg.embeds.length > 0) {
          let statusText = '⏳ En attente';
          let embedColor = 0x3B82F6;
          if (status === 'approved') {
            statusText = `✅ **Approuvée par ${reviewer.username}**`;
            embedColor = 0x10B981;
          } else if (status === 'in_discussion') {
            statusText = `💬 **En discussion avec l'équipe (${reviewer.username})**`;
            embedColor = 0xF59E0B;
          } else if (status === 'rejected') {
            statusText = `❌ **Refusée par ${reviewer.username}**`;
            embedColor = 0xEF4444;
          }

          const updatedEmbed = EmbedBuilder.from(msg.embeds[0])
            .setColor(embedColor)
            .spliceFields(2, 1, { name: '📌 Statut', value: statusText, inline: true });

          const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`cortex_sug_approve_${sug.id}`)
              .setLabel('Approuvée')
              .setEmoji('✅')
              .setStyle(ButtonStyle.Success)
              .setDisabled(status === 'approved'),
            new ButtonBuilder()
              .setCustomId(`cortex_sug_discuss_${sug.id}`)
              .setLabel('En discussion')
              .setEmoji('💬')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(status === 'in_discussion'),
            new ButtonBuilder()
              .setCustomId(`cortex_sug_reject_${sug.id}`)
              .setLabel('Refusée')
              .setEmoji('❌')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(status === 'rejected')
          );

          await msg.edit({
            embeds: [updatedEmbed],
            components: [actionRow]
          });
        }
      }
    }

    // Notification MP à l'auteur
    if (guild) {
      const authorMember = await guild.members.fetch(sug.user_id).catch(() => null);
      if (authorMember) {
        let dmTitle = '';
        let dmDesc = '';
        let dmColor = 0x3B82F6;

        if (status === 'approved') {
          dmTitle = '🎉 Votre suggestion a été approuvée !';
          dmDesc = `Bonjour <@${sug.user_id}>,\n\nVotre proposition **"${sug.title}"** a été examinée par les responsables et **retenue avec succès** pour le club !\n\n${reviewNotes ? `*Note de l'équipe : ${reviewNotes}*\n\n` : ''}Merci pour votre engagement envers CORTEX Scientific Club.`;
          dmColor = 0x10B981;
        } else if (status === 'in_discussion') {
          dmTitle = '💬 Votre suggestion est en cours de discussion';
          dmDesc = `Bonjour <@${sug.user_id}>,\n\nVotre proposition **"${sug.title}"** a retenu l'attention des responsables et est actuellement **en cours d'étude logistique** avec l'équipe !\n\n${reviewNotes ? `*Note : ${reviewNotes}*` : ''}`;
          dmColor = 0xF59E0B;
        } else if (status === 'rejected') {
          dmTitle = 'ℹ️ Information concernant votre suggestion';
          dmDesc = `Bonjour <@${sug.user_id}>,\n\nVotre proposition **"${sug.title}"** a été attentivement étudiée par les responsables. Pour des raisons techniques ou organisationnelles, elle ne pourra pas être mise en œuvre dans l'immédiat.\n\n${reviewNotes ? `*Précisions : ${reviewNotes}*\n\n` : ''}Nous vous remercions pour votre démarche !`;
          dmColor = 0xEF4444;
        }

        if (dmTitle) {
          const dmEmbed = new EmbedBuilder()
            .setTitle(dmTitle)
            .setColor(dmColor)
            .setDescription(dmDesc)
            .setFooter({ text: 'CORTEX Scientific Club • Boîte à idées' })
            .setTimestamp();

          await authorMember.send({ embeds: [dmEmbed] }).catch(() => null);
        }
      }
    }
  } catch {}

  res.json({
    success: true,
    message: `Suggestion mise à jour avec le statut : ${status}.`
  });
});
