import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  TextChannel
} from 'discord.js';
import { db } from '../database/db.js';
import { logger } from '../utils/logger.js';

/**
 * Affiche le modal de création d'une suggestion
 */
export async function handleSuggestionButtonClick(interaction: ButtonInteraction) {
  if (!interaction.guild) return;

  const modal = new ModalBuilder()
    .setCustomId('cortex_suggestion_modal')
    .setTitle('💡 Boîte à Idées & Suggestions');

  const titleInput = new TextInputBuilder()
    .setCustomId('sug_title')
    .setLabel('Titre de votre proposition :')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex : Atelier IA générative, Hackathon Robotique...')
    .setMinLength(5)
    .setMaxLength(100)
    .setRequired(true);

  const descInput = new TextInputBuilder()
    .setCustomId('sug_desc')
    .setLabel('Description détaillée de l\'idée :')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Expliquez en détail votre proposition, son organisation ou son contenu...')
    .setMinLength(15)
    .setMaxLength(1500)
    .setRequired(true);

  const benefitsInput = new TextInputBuilder()
    .setCustomId('sug_benefits')
    .setLabel('Bénéfices & Impact pour le club (optionnel) :')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Qu\'est-ce que cela apportera aux membres ou au rayonnement du club ?')
    .setMaxLength(1000)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(benefitsInput)
  );

  await interaction.showModal(modal);
}

/**
 * Traite la soumission du modal de suggestion
 */
export async function handleSuggestionModalSubmit(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  const guildId = interaction.guild.id;
  const title = interaction.fields.getTextInputValue('sug_title');
  const description = interaction.fields.getTextInputValue('sug_desc');
  const benefits = interaction.fields.getTextInputValue('sug_benefits') || null;

  const config = (await db.prepare('SELECT * FROM suggestion_configs WHERE guild_id = ?').get(guildId)) as any;
  if (!config || !config.review_channel_id) {
    await interaction.reply({
      content: '⚠️ Le salon de réception des suggestions n\'a pas encore été configuré par les administrateurs dans le Dashboard.',
      ephemeral: true
    });
    return;
  }

  const suggestionId = `sug_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  // Enregistrer en base
  await db.prepare(`
    INSERT INTO suggestions (id, guild_id, user_id, title, description, benefits, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).run(suggestionId, guildId, interaction.user.id, title, description, benefits);

  // Mettre à jour l'utilisateur
  try {
    await db.prepare(`
      INSERT INTO users (id, username, discriminator, avatar)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        discriminator = excluded.discriminator,
        avatar = excluded.avatar
    `).run(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator || '0',
      interaction.user.avatar || null
    );
  } catch {}

  // Confirmation immédiate à l'utilisateur
  await interaction.reply({
    content: `💡 Merci <@${interaction.user.id}> ! Votre suggestion **"${title}"** a été enregistrée avec succès et transmise à l'équipe dans le salon dédié.`,
    ephemeral: true
  });

  // Envoyer dans le salon de réception Discord
  try {
    const reviewChannel = await interaction.guild.channels.fetch(config.review_channel_id).catch(() => null);
    if (reviewChannel && reviewChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle(`💡 NOUVELLE SUGGESTION : ${title.slice(0, 200)}`)
        .setColor(0x3B82F6) // Bleu CORTEX
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '👤 Proposé par', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
          { name: '📅 Date', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: '📌 Statut', value: '⏳ **En attente d\'examen**', inline: true },
          { name: '📝 Description', value: description.slice(0, 1024) },
          { name: '🚀 Impact & Bénéfices', value: benefits ? benefits.slice(0, 1024) : '*Non spécifié*' }
        )
        .setFooter({ text: `ID: ${suggestionId} • Cliquez sur les boutons ci-dessous pour traiter ou réagissez pour voter` })
        .setTimestamp();

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`cortex_sug_approve_${suggestionId}`)
          .setLabel('Approuver')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cortex_sug_discuss_${suggestionId}`)
          .setLabel('En discussion')
          .setEmoji('💬')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`cortex_sug_reject_${suggestionId}`)
          .setLabel('Refuser')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
      );

      const msg = await (reviewChannel as TextChannel).send({
        embeds: [embed],
        components: [actionRow]
      });

      // Ajouter automatiquement les réactions pour le vote communautaire
      await msg.react('👍').catch(() => null);
      await msg.react('👎').catch(() => null);

      // Associer le message discord
      await db.prepare('UPDATE suggestions SET discord_message_id = ? WHERE id = ?').run(msg.id, suggestionId);
    }
  } catch (err: any) {
    logger.error({ err }, 'Erreur lors de l\'envoi de la suggestion dans le salon de réception Discord');
  }
}

/**
 * Traite les boutons d'action du staff (Approuver, En discussion, Refuser)
 */
export async function handleSuggestionStaffReview(interaction: ButtonInteraction) {
  if (!interaction.guild) return;

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const canReview = member.permissions.has(PermissionFlagsBits.ManageGuild) ||
                    member.permissions.has(PermissionFlagsBits.Administrator) ||
                    member.permissions.has(PermissionFlagsBits.ManageMessages);

  if (!canReview) {
    await interaction.reply({
      content: '⛔ Vous devez avoir la permission de gérer le serveur ou les messages pour traiter les suggestions.',
      ephemeral: true
    });
    return;
  }

  let newStatus: 'approved' | 'in_discussion' | 'rejected' = 'approved';
  let suggestionId = '';

  if (interaction.customId.startsWith('cortex_sug_approve_')) {
    newStatus = 'approved';
    suggestionId = interaction.customId.replace('cortex_sug_approve_', '');
  } else if (interaction.customId.startsWith('cortex_sug_discuss_')) {
    newStatus = 'in_discussion';
    suggestionId = interaction.customId.replace('cortex_sug_discuss_', '');
  } else if (interaction.customId.startsWith('cortex_sug_reject_')) {
    newStatus = 'rejected';
    suggestionId = interaction.customId.replace('cortex_sug_reject_', '');
  }

  if (!suggestionId) return;

  const sug = (await db.prepare('SELECT * FROM suggestions WHERE id = ? AND guild_id = ?').get(suggestionId, interaction.guild.id)) as any;
  if (!sug) {
    await interaction.reply({ content: '❌ Suggestion introuvable.', ephemeral: true });
    return;
  }

  // Mettre à jour en base
  await db.prepare(`
    UPDATE suggestions
    SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, interaction.user.id, suggestionId);

  // Mettre à jour l'Embed Discord
  const oldEmbed = interaction.message.embeds[0];
  if (oldEmbed) {
    let statusText = '⏳ En attente';
    let embedColor = 0x3B82F6;
    if (newStatus === 'approved') {
      statusText = `✅ **Approuvée par <@${interaction.user.id}>**`;
      embedColor = 0x10B981;
    } else if (newStatus === 'in_discussion') {
      statusText = `💬 **En discussion avec l'équipe (<@${interaction.user.id}>)**`;
      embedColor = 0xF59E0B;
    } else if (newStatus === 'rejected') {
      statusText = `❌ **Refusée par <@${interaction.user.id}>**`;
      embedColor = 0xEF4444;
    }

    const updatedEmbed = EmbedBuilder.from(oldEmbed)
      .setColor(embedColor)
      .spliceFields(2, 1, { name: '📌 Statut', value: statusText, inline: true });

    // Conserver les boutons avec le bouton cliqué désactivé ou mis en évidence
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`cortex_sug_approve_${suggestionId}`)
        .setLabel('Approuvée')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
        .setDisabled(newStatus === 'approved'),
      new ButtonBuilder()
        .setCustomId(`cortex_sug_discuss_${suggestionId}`)
        .setLabel('En discussion')
        .setEmoji('💬')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(newStatus === 'in_discussion'),
      new ButtonBuilder()
        .setCustomId(`cortex_sug_reject_${suggestionId}`)
        .setLabel('Refusée')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(newStatus === 'rejected')
    );

    await interaction.update({
      embeds: [updatedEmbed],
      components: [actionRow]
    });
  }

  // Notification MP chaleureuse à l'auteur de la suggestion
  try {
    const authorMember = await interaction.guild.members.fetch(sug.user_id).catch(() => null);
    if (authorMember) {
      let dmTitle = '';
      let dmDesc = '';
      let dmColor = 0x3B82F6;

      if (newStatus === 'approved') {
        dmTitle = '🎉 Votre suggestion a été approuvée !';
        dmDesc = `Bonjour <@${sug.user_id}>,\n\nVotre proposition **"${sug.title}"** a été examinée par les responsables et **retenue avec succès** pour le club !\n\nMerci pour votre engagement et votre contribution à CORTEX Scientific Club.`;
        dmColor = 0x10B981;
      } else if (newStatus === 'in_discussion') {
        dmTitle = '💬 Votre suggestion est en cours de discussion';
        dmDesc = `Bonjour <@${sug.user_id}>,\n\nVotre proposition **"${sug.title}"** a retenu l'attention des responsables et est actuellement **en cours de discussion technique et logistique** avec l'équipe !`;
        dmColor = 0xF59E0B;
      } else {
        dmTitle = 'ℹ️ Information concernant votre suggestion';
        dmDesc = `Bonjour <@${sug.user_id}>,\n\nVotre proposition **"${sug.title}"** a été attentivement étudiée par les responsables. Pour des raisons techniques ou organisationnelles, elle ne pourra pas être mise en œuvre dans l'immédiat.\n\nNous vous remercions sincèrement pour votre initiative et restons à l'écoute de vos futures idées !`;
        dmColor = 0xEF4444;
      }

      const dmEmbed = new EmbedBuilder()
        .setTitle(dmTitle)
        .setColor(dmColor)
        .setDescription(dmDesc)
        .setFooter({ text: 'CORTEX Scientific Club • Boîte à idées' })
        .setTimestamp();

      await authorMember.send({ embeds: [dmEmbed] }).catch(() => null);
    }
  } catch {}
}
