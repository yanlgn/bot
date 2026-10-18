import {
  StringSelectMenuInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
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

export async function showDepartmentApplicationModal(
  interaction: StringSelectMenuInteraction | ButtonInteraction | ChatInputCommandInteraction,
  deptId: string
) {
  if (!interaction.guild) return;

  const dept = (await db.prepare('SELECT * FROM departments WHERE id = ? AND guild_id = ?').get(deptId, interaction.guild.id)) as any;
  if (!dept) {
    await interaction.reply({ content: '❌ Ce pôle scientifique est introuvable.', ephemeral: true });
    return;
  }

  // Vérifier si déjà membre ou en attente
  const existing = (await db.prepare('SELECT * FROM department_members WHERE department_id = ? AND user_id = ?').get(dept.id, interaction.user.id)) as any;
  if (existing) {
    if (existing.status === 'approved') {
      await interaction.reply({
        content: `✅ Vous êtes déjà membre officiel du pôle **${dept.name}** !`,
        ephemeral: true
      });
      return;
    }
    if (existing.status === 'pending') {
      await interaction.reply({
        content: `⏳ Vous avez déjà une candidature en attente d'examen pour le pôle **${dept.name}**.`,
        ephemeral: true
      });
      return;
    }
  }

  const modal = new ModalBuilder()
    .setCustomId(`cortex_dept_modal_${dept.id}`)
    .setTitle(`Candidature : ${dept.name}`.slice(0, 45));

  const motivationInput = new TextInputBuilder()
    .setCustomId('dept_motivation')
    .setLabel('Vos motivations pour ce pôle :')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Pourquoi souhaitez-vous rejoindre ce pôle et que souhaitez-vous y accomplir ?')
    .setMinLength(10)
    .setMaxLength(1000)
    .setRequired(true);

  const skillsInput = new TextInputBuilder()
    .setCustomId('dept_skills')
    .setLabel('Compétences / Technologies / Projets :')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Ex : Python, PyTorch, C++, Arduino, ROS, Web, design, ou débutant curieux...')
    .setMinLength(2)
    .setMaxLength(1000)
    .setRequired(true);

  const availabilityInput = new TextInputBuilder()
    .setCustomId('dept_availability')
    .setLabel('Temps disponible estimé :')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex : 3 à 5 heures par semaine, disponible les week-ends...')
    .setMaxLength(100)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(motivationInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(skillsInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(availabilityInput)
  );

  await interaction.showModal(modal);
}

export async function handleDepartmentModalSubmit(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  const deptId = interaction.customId.replace('cortex_dept_modal_', '');
  const dept = (await db.prepare('SELECT * FROM departments WHERE id = ? AND guild_id = ?').get(deptId, interaction.guild.id)) as any;
  if (!dept) {
    await interaction.reply({ content: '❌ Ce pôle scientifique est introuvable.', ephemeral: true });
    return;
  }

  const motivation = interaction.fields.getTextInputValue('dept_motivation');
  const skills = interaction.fields.getTextInputValue('dept_skills');
  const availability = interaction.fields.getTextInputValue('dept_availability') || 'Non précisé';

  // Enregistrer/mettre à jour l'utilisateur dans users
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

  // Enregistrer la candidature dans department_members
  await db.prepare(`
    INSERT INTO department_members (department_id, guild_id, user_id, role, status, motivation, skills, availability, requested_at)
    VALUES (?, ?, ?, 'member', 'pending', ?, ?, ?, datetime('now'))
    ON CONFLICT(department_id, user_id) DO UPDATE SET
      status = 'pending',
      motivation = excluded.motivation,
      skills = excluded.skills,
      availability = excluded.availability,
      requested_at = datetime('now')
  `).run(dept.id, interaction.guild.id, interaction.user.id, motivation, skills, availability);

  // Répondre à l'utilisateur
  const userConfirmEmbed = new EmbedBuilder()
    .setTitle(`🎉 Candidature envoyée : Pôle ${dept.name}`)
    .setColor(0x10B981)
    .setDescription(`Merci <@${interaction.user.id}> ! Votre candidature a été transmise aux responsables du pôle **${dept.icon || '🔬'} ${dept.name}**.`)
    .addFields(
      { name: '🎯 Motivations', value: motivation.slice(0, 1024) },
      { name: '🛠️ Compétences & Expérience', value: skills.slice(0, 1024) },
      { name: '⏱️ Disponibilité', value: availability, inline: true }
    )
    .setFooter({ text: 'CORTEX Scientific Club • Vous recevrez une notification lors du traitement de votre dossier.' });

  await interaction.reply({ embeds: [userConfirmEmbed], ephemeral: true });

  // Notifier le salon candidature du pôle Discord
  try {
    let notifyChannel: TextChannel | null = null;
    const guild = interaction.guild;
    const channels = await guild.channels.fetch();

    // 1. Chercher en priorité un salon "candidatures" dans la catégorie du pôle
    if (dept.category_id) {
      notifyChannel = channels.find(c =>
        c && c.isTextBased() &&
        c.parentId === dept.category_id &&
        c.name.includes('candidat')
      ) as TextChannel | null;
    }

    // 2. Si non trouvé dans la catégorie, chercher un salon dédié aux candidatures de ce pôle
    if (!notifyChannel) {
      const slug = (dept.short_name || dept.name).toLowerCase().replace(/[^a-z0-9]/g, '');
      notifyChannel = channels.find(c => {
        if (!c || !c.isTextBased()) return false;
        const cName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cName.includes('candidat') && (slug.length > 2 ? cName.includes(slug) : false);
      }) as TextChannel | null;
    }

    // 3. Si non trouvé, chercher un salon général de candidatures ou staff
    if (!notifyChannel) {
      notifyChannel = channels.find(c =>
        c && c.isTextBased() &&
        (c.name.includes('candidat') || c.name.includes('recrutement') || c.name.includes('staff') || c.name.includes('admin') || c.name.includes('logs'))
      ) as TextChannel | null;
    }

    // 4. Si non trouvé, chercher le premier salon textuel de la catégorie du pôle
    if (!notifyChannel && dept.category_id) {
      notifyChannel = channels.find(c => c && c.isTextBased() && c.parentId === dept.category_id) as TextChannel | null;
    }

    if (notifyChannel) {
      const staffEmbed = new EmbedBuilder()
        .setTitle(`📥 Nouvelle candidature — Pôle ${dept.icon || '🔬'} ${dept.name}`)
        .setColor(0xE5092E)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '👤 Candidat', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
          { name: '🔬 Pôle visé', value: `**${dept.name}**`, inline: true },
          { name: '⏱️ Disponibilité', value: availability, inline: true },
          { name: '🎯 Motivations', value: motivation.slice(0, 1024) },
          { name: '🛠️ Compétences & Projets', value: skills.slice(0, 1024) }
        )
        .setFooter({ text: `ID Candidat: ${interaction.user.id} • Pôle: ${dept.id}` })
        .setTimestamp();

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`cortex_dept_app_${dept.id}_${interaction.user.id}`)
          .setLabel('Valider l\'adhésion')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`cortex_dept_rej_${dept.id}_${interaction.user.id}`)
          .setLabel('Refuser')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

      const pings = [
        dept.leader_role_id ? `<@&${dept.leader_role_id}>` : null,
        dept.deputy_role_id ? `<@&${dept.deputy_role_id}>` : null
      ].filter(Boolean).join(' ');

      await notifyChannel.send({
        content: pings || undefined,
        embeds: [staffEmbed],
        components: [actionRow]
      });
    }
  } catch (err: any) {
    logger.warn({ error: err }, 'Impossible d\'envoyer la notification de candidature dans le salon staff Discord');
  }
}

export async function handleDepartmentStaffReview(interaction: ButtonInteraction) {
  if (!interaction.guild) return;

  const isApprove = interaction.customId.startsWith('cortex_dept_app_');
  const raw = isApprove
    ? interaction.customId.replace('cortex_dept_app_', '')
    : interaction.customId.replace('cortex_dept_rej_', '');

  const parts = raw.split('_');
  const deptId = parts[0];
  const candidateUserId = parts.slice(1).join('_');
  if (!deptId || !candidateUserId) return;

  const dept = (await db.prepare('SELECT * FROM departments WHERE id = ? AND guild_id = ?').get(deptId, interaction.guild.id)) as any;
  if (!dept) {
    await interaction.reply({ content: '❌ Pôle introuvable.', ephemeral: true });
    return;
  }

  // Vérifier permissions de l'opérateur (Chef, Adjoint ou Admin)
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isLeader = dept.leader_role_id && member.roles.cache.has(dept.leader_role_id);
  const isDeputy = dept.deputy_role_id && member.roles.cache.has(dept.deputy_role_id);
  const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!isLeader && !isDeputy && !isAdmin) {
    await interaction.reply({
      content: '⛔ Vous devez être Chef, Adjoint de ce pôle ou Administrateur pour valider ou refuser cette candidature.',
      ephemeral: true
    });
    return;
  }

  const newStatus = isApprove ? 'approved' : 'rejected';

  await db.prepare(`
    UPDATE department_members 
    SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
    WHERE department_id = ? AND user_id = ?
  `).run(newStatus, interaction.user.id, dept.id, candidateUserId);

  let roleGiven = false;
  if (isApprove && dept.member_role_id) {
    const candidateMember = await interaction.guild.members.fetch(candidateUserId).catch(() => null);
    if (candidateMember) {
      await candidateMember.roles.add(dept.member_role_id, `Cortex : Candidature validée par ${interaction.user.tag}`).catch(() => null);
      roleGiven = true;
      await candidateMember.send({
        content: `🎉 Félicitations ! Votre candidature pour rejoindre le pôle **${dept.icon || '🔬'} ${dept.name}** au sein de **CORTEX Scientific Club** a été **validée** par <@${interaction.user.id}> ! Vous avez reçu le rôle associé.`
      }).catch(() => null);
    }
  }

  const oldEmbed = interaction.message.embeds[0];
  if (!oldEmbed) {
    await interaction.reply({ content: 'Message introuvable.', ephemeral: true });
    return;
  }

  const updatedEmbed = EmbedBuilder.from(oldEmbed)
    .setColor(isApprove ? 0x10B981 : 0xEF4444)
    .addFields({
      name: isApprove ? '✅ Décision : Acceptée' : '❌ Décision : Refusée',
      value: `Traité par <@${interaction.user.id}> le <t:${Math.floor(Date.now() / 1000)}:R>${roleGiven ? '\n*(Rôle Discord membre attribué)*' : ''}`
    });

  await interaction.update({
    embeds: [updatedEmbed],
    components: []
  });

  logger.info(`Candidature de ${candidateUserId} pour le pôle ${dept.name} ${newStatus} par ${interaction.user.tag}`);
}
