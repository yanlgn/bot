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
 * Affiche le formulaire modal de candidature générale au club
 */
export async function handleCandidatureButtonClick(interaction: ButtonInteraction) {
  if (!interaction.guild) return;

  const guildId = interaction.guild.id;

  // Vérifier si une candidature est déjà en attente
  const existing = (await db.prepare('SELECT * FROM candidatures WHERE guild_id = ? AND user_id = ? AND status = \'pending\'').get(guildId, interaction.user.id)) as any;
  if (existing) {
    await interaction.reply({
      content: '⏳ Vous avez déjà une candidature d\'adhésion en attente d\'examen par les responsables du club.',
      ephemeral: true
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('cortex_cand_modal')
    .setTitle('📝 Candidature — CORTEX Scientific Club');

  const studyInput = new TextInputBuilder()
    .setCustomId('cand_study')
    .setLabel('Filière / Spécialité & Niveau :')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex : L3 Informatique, Master IA, Cycle Ingénieur...')
    .setMinLength(2)
    .setMaxLength(100)
    .setRequired(true);

  const motivationInput = new TextInputBuilder()
    .setCustomId('cand_motivation')
    .setLabel('Vos motivations pour rejoindre CORTEX :')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Pourquoi souhaitez-vous rejoindre le club et que souhaitez-vous y apporter ?')
    .setMinLength(10)
    .setMaxLength(1000)
    .setRequired(true);

  const interestsInput = new TextInputBuilder()
    .setCustomId('cand_interests')
    .setLabel('Centres d\'intérêt & Compétences :')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Ex : Intelligence Artificielle, Robotique, Électronique, Web, Design, ou débutant motivé...')
    .setMinLength(2)
    .setMaxLength(1000)
    .setRequired(true);

  const availabilityInput = new TextInputBuilder()
    .setCustomId('cand_availability')
    .setLabel('Temps disponible estimé :')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex : 3 à 5 heures par semaine, disponible les week-ends...')
    .setMaxLength(100)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(studyInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(motivationInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(interestsInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(availabilityInput)
  );

  await interaction.showModal(modal);
}

/**
 * Traite la soumission du formulaire modal de candidature au club
 */
export async function handleCandidatureModalSubmit(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  const guildId = interaction.guild.id;
  const studyField = interaction.fields.getTextInputValue('cand_study');
  const motivation = interaction.fields.getTextInputValue('cand_motivation');
  const interests = interaction.fields.getTextInputValue('cand_interests');
  const availability = interaction.fields.getTextInputValue('cand_availability') || 'Non précisé';

  const config = (await db.prepare('SELECT * FROM candidature_configs WHERE guild_id = ?').get(guildId)) as any;
  const candId = `cand_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  // Enregistrer en base
  await db.prepare(`
    INSERT INTO candidatures (id, guild_id, user_id, study_field, motivation, interests, availability, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).run(candId, guildId, interaction.user.id, studyField, motivation, interests, availability);

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
  const confirmEmbed = new EmbedBuilder()
    .setTitle('🎉 Candidature Envoyée avec Succès')
    .setColor(0x10B981)
    .setDescription(`Merci <@${interaction.user.id}> ! Votre demande d'adhésion officielle à **CORTEX Scientific Club** a été enregistrée et transmise aux responsables.`)
    .addFields(
      { name: '🎓 Cursus / Filière', value: studyField, inline: true },
      { name: '⏱️ Disponibilité', value: availability, inline: true },
      { name: '🎯 Motivations', value: motivation.slice(0, 1024) },
      { name: '🔬 Domaines d\'intérêt', value: interests.slice(0, 1024) }
    )
    .setFooter({ text: 'CORTEX Scientific Club • Vous recevrez une notification par message privé lors de l\'examen de votre dossier.' })
    .setTimestamp();

  await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

  // Notifier le salon staff Discord
  if (config?.review_channel_id) {
    try {
      const reviewChannel = await interaction.guild.channels.fetch(config.review_channel_id).catch(() => null);
      if (reviewChannel && reviewChannel.isTextBased()) {
        const staffEmbed = new EmbedBuilder()
          .setTitle('📥 NOUVELLE CANDIDATURE AU CLUB — CORTEX')
          .setColor(0xE5092E)
          .setThumbnail(interaction.user.displayAvatarURL())
          .addFields(
            { name: '👤 Candidat', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
            { name: '🎓 Filière', value: studyField, inline: true },
            { name: '⏱️ Disponibilité', value: availability, inline: true },
            { name: '🎯 Motivations', value: motivation.slice(0, 1024) },
            { name: '🛠️ Compétences & Centres d\'intérêt', value: interests.slice(0, 1024) }
          )
          .setFooter({ text: `ID Candidat: ${interaction.user.id} • Réf: ${candId}` })
          .setTimestamp();

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`cortex_cand_app_${candId}_${interaction.user.id}`)
            .setLabel('Valider l\'adhésion')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`cortex_cand_rej_${candId}_${interaction.user.id}`)
            .setLabel('Refuser')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
        );

        const sentMsg = await (reviewChannel as TextChannel).send({
          embeds: [staffEmbed],
          components: [actionRow]
        });

        await db.prepare('UPDATE candidatures SET discord_message_id = ? WHERE id = ?').run(sentMsg.id, candId);
      }
    } catch (err: any) {
      logger.error({ err }, 'Erreur lors de l\'envoi de la candidature au club dans le salon staff Discord');
    }
  }
}

/**
 * Traite les boutons de validation / refus d'une candidature au club
 */
export async function handleCandidatureStaffReview(interaction: ButtonInteraction) {
  if (!interaction.guild) return;

  const isApprove = interaction.customId.startsWith('cortex_cand_app_');
  const raw = isApprove
    ? interaction.customId.replace('cortex_cand_app_', '')
    : interaction.customId.replace('cortex_cand_rej_', '');

  let candId = '';
  let candidateUserId = '';

  const lastUnderscore = raw.lastIndexOf('_');
  if (lastUnderscore !== -1) {
    candId = raw.substring(0, lastUnderscore);
    candidateUserId = raw.substring(lastUnderscore + 1);
  }

  if (!candId || !candidateUserId) return;

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const canReview = member.permissions.has(PermissionFlagsBits.ManageGuild) ||
                    member.permissions.has(PermissionFlagsBits.Administrator) ||
                    member.permissions.has(PermissionFlagsBits.ManageRoles);

  if (!canReview) {
    await interaction.reply({
      content: '⛔ Vous devez avoir la permission d\'administrer le serveur ou de gérer les rôles pour traiter les candidatures.',
      ephemeral: true
    });
    return;
  }

  const newStatus = isApprove ? 'accepted' : 'rejected';

  await db.prepare(`
    UPDATE candidatures
    SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, interaction.user.id, candId);

  // Si approuvé, attribuer le rôle membre officiel
  let roleGiven = false;
  if (isApprove) {
    const config = (await db.prepare('SELECT * FROM candidature_configs WHERE guild_id = ?').get(interaction.guild.id)) as any;
    let memberRoleId = config?.member_role_id;

    if (!memberRoleId) {
      const foundRole = interaction.guild.roles.cache.find(r =>
        r.name.toLowerCase().includes('membre officiel') ||
        r.name.toLowerCase().includes('membre cortex') ||
        r.name.toLowerCase() === 'membre'
      );
      if (foundRole) memberRoleId = foundRole.id;
    }

    const candidateMember = await interaction.guild.members.fetch(candidateUserId).catch(() => null);
    if (candidateMember) {
      if (memberRoleId) {
        await candidateMember.roles.add(memberRoleId, `Cortex : Adhésion validée par ${interaction.user.tag}`).catch(() => null);
        roleGiven = true;
      }
      await candidateMember.send({
        content: `🎉 Félicitations ! Votre candidature d'adhésion officielle à **CORTEX Scientific Club** a été **validée** par <@${interaction.user.id}> ! Bienvenue parmi nous !`
      }).catch(() => null);
    }
  } else {
    const candidateMember = await interaction.guild.members.fetch(candidateUserId).catch(() => null);
    if (candidateMember) {
      await candidateMember.send({
        content: `ℹ️ Bonjour <@${candidateUserId}>,\n\nVotre candidature pour rejoindre **CORTEX Scientific Club** a été examinée par les responsables.\n\nMalheureusement, elle n'a pas pu être retenue pour cette session. Nous vous remercions chaleureusement pour votre démarche et votre intérêt envers notre club !`
      }).catch(() => null);
    }
  }

  // Mettre à jour l'Embed dans le salon staff
  const oldEmbed = interaction.message.embeds[0];
  if (oldEmbed) {
    const updatedEmbed = EmbedBuilder.from(oldEmbed)
      .setColor(isApprove ? 0x10B981 : 0xEF4444)
      .addFields({
        name: isApprove ? '✅ Décision : Acceptée' : '❌ Décision : Refusée',
        value: `Traité par <@${interaction.user.id}> le <t:${Math.floor(Date.now() / 1000)}:R>${roleGiven ? '\n*(Rôle Discord Membre attribué)*' : ''}`
      });

    await interaction.update({
      embeds: [updatedEmbed],
      components: []
    });
  }

  logger.info(`Candidature club ${candId} (${candidateUserId}) ${newStatus} par ${interaction.user.tag}`);
}
