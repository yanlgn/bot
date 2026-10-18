import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { db } from '../../database/db.js';
import { showDepartmentApplicationModal } from '../../interactions/departmentInteractions.js';

export const data = new SlashCommandBuilder()
  .setName('departement')
  .setDescription('Gestion des départements (pôles scientifiques) de CORTEX')
  .addSubcommand(sub =>
    sub.setName('liste')
      .setDescription('Afficher la liste des pôles scientifiques actifs du club')
  )
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('Consulter les détails, responsables et projets d\'un pôle')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom ou ID du pôle').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('rejoindre')
      .setDescription('Ouvrir le formulaire de candidature pour intégrer un pôle')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom ou ID du pôle à rejoindre').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('demandes')
      .setDescription('Consulter et examiner les candidatures en attente')
      .addStringOption(opt => opt.setName('nom').setDescription('Filtrer par nom ou ID du pôle').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('valider')
      .setDescription('Approuver l\'adhésion d\'un membre candidat')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom ou ID du pôle').setRequired(true))
      .addUserOption(opt => opt.setName('membre').setDescription('Membre candidat').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('refuser')
      .setDescription('Refuser la candidature d\'un membre')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom ou ID du pôle').setRequired(true))
      .addUserOption(opt => opt.setName('membre').setDescription('Membre candidat').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  // 1. Liste des pôles
  if (subcommand === 'liste') {
    const departments = (await db.prepare(`
      SELECT d.*, 
        (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id AND dm.status = 'approved') as members_count,
        (SELECT COUNT(*) FROM projects p WHERE p.department_id = d.id) as projects_count
      FROM departments d
      WHERE d.guild_id = ? AND d.is_archived = 0
      ORDER BY d.created_at ASC
    `).all(guildId)) as any[];

    if (departments.length === 0) {
      await interaction.reply({
        content: 'ℹ️ Aucun pôle scientifique n\'a encore été configuré. Utilisez le **Dashboard CORTEX** pour en créer.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🔬 CORTEX Scientific Club — Pôles d\'Excellence')
      .setDescription(
        'Explorez nos départements de recherche, d\'ingénierie et d\'innovation. ' +
        'Sélectionnez un pôle ci-dessous pour déposer votre candidature via le formulaire officiel :\n'
      )
      .setColor(0xE5092E)
      .setFooter({ text: 'CORTEX Scientific Club • Choisissez un pôle ci-dessous pour postuler' });

    for (const d of departments) {
      const leaderRole = d.leader_role_id ? `<@&${d.leader_role_id}>` : '*Non assigné*';
      const category = d.category_id ? `<#${d.category_id}>` : '*Non assignée*';
      embed.addFields({
        name: `${d.icon || '🔬'} ${d.name} (${d.short_name || d.id})`,
        value: `${d.description ? `> ${d.description}\n` : ''}👥 **${d.members_count} membre(s)** • 💡 **${d.projects_count} projet(s)**\n🎖️ **Responsable :** ${leaderRole} • 📁 **Espace :** ${category}`,
        inline: false
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('cortex_dept_select')
      .setPlaceholder('🎯 Postuler : choisissez votre pôle scientifique...')
      .addOptions(
        departments.slice(0, 25).map(d => ({
          label: d.name.slice(0, 100),
          value: d.id,
          description: (d.description || 'Postuler à ce pôle').slice(0, 100),
          emoji: d.icon || '🔬'
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row] });
    return;
  }

  // 2. Info sur un pôle
  if (subcommand === 'info') {
    const query = interaction.options.getString('nom', true).toLowerCase();
    const dept = (await db.prepare(`
      SELECT d.*, 
        (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id AND dm.status = 'approved') as members_count,
        (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id AND dm.status = 'pending') as pending_count
      FROM departments d
      WHERE d.guild_id = ? AND (d.id = ? OR LOWER(d.name) LIKE ? OR LOWER(d.short_name) = ?)
    `).get(guildId, query, `%${query}%`, query)) as any;

    if (!dept) {
      await interaction.reply({ content: `❌ Pôle introuvable avec "${query}". Tapez \`/departement liste\`.`, ephemeral: true });
      return;
    }

    const projects = (await db.prepare('SELECT id, name, status FROM projects WHERE department_id = ? LIMIT 5').all(dept.id)) as any[];

    const embed = new EmbedBuilder()
      .setTitle(`${dept.icon || '🔬'} Pôle Scientifique : ${dept.name}`)
      .setDescription(dept.description || 'Pôle de recherche et développement technique au sein de CORTEX.')
      .setColor(dept.color ? parseInt(dept.color.replace('#', ''), 16) : 0xE5092E)
      .addFields(
        { name: '👥 Effectif actif', value: `**${dept.members_count}** membre(s)`, inline: true },
        { name: '🎖️ Rôle Chef', value: dept.leader_role_id ? `<@&${dept.leader_role_id}>` : '*Aucun*', inline: true },
        { name: '🥈 Rôle Adjoint', value: dept.deputy_role_id ? `<@&${dept.deputy_role_id}>` : '*Aucun*', inline: true },
        { name: '🏷️ Rôle Membre', value: dept.member_role_id ? `<@&${dept.member_role_id}>` : '*Aucun*', inline: true },
        {
          name: '🚀 Projets & Activités',
          value: projects.length > 0
            ? projects.map(p => `• **${p.name}** (${p.status})`).join('\n')
            : '*Aucun projet rattaché pour le moment.*'
        }
      )
      .setFooter({ text: `ID Pôle: ${dept.id}` });

    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`cortex_dept_btn_${dept.id}`)
        .setLabel('Postuler à ce pôle')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(dept.icon || '🔬')
    );

    await interaction.reply({ embeds: [embed], components: [btnRow] });
    return;
  }

  // 3. Rejoindre via formulaire Modal
  if (subcommand === 'rejoindre') {
    const query = interaction.options.getString('nom', true).toLowerCase();
    const dept = (await db.prepare(`
      SELECT * FROM departments 
      WHERE guild_id = ? AND is_archived = 0 AND (id = ? OR LOWER(name) LIKE ? OR LOWER(short_name) = ?)
    `).get(guildId, query, `%${query}%`, query)) as any;

    if (!dept) {
      await interaction.reply({
        content: `❌ Pôle introuvable avec la recherche "${query}". Tapez \`/departement liste\` pour voir tous les pôles disponibles.`,
        ephemeral: true
      });
      return;
    }

    // Lance directement le formulaire Modal Discord
    await showDepartmentApplicationModal(interaction, dept.id);
    return;
  }

  // 4. Demandes en attente
  if (subcommand === 'demandes') {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild);

    const pending = (await db.prepare(`
      SELECT dm.*, d.name as dept_name, d.icon as dept_icon, d.leader_role_id, d.deputy_role_id
      FROM department_members dm
      JOIN departments d ON d.id = dm.department_id
      WHERE dm.guild_id = ? AND dm.status = 'pending'
      ORDER BY dm.requested_at ASC
    `).all(guildId)) as any[];

    const filtered = pending.filter(p => {
      if (isAdmin) return true;
      const isLeader = p.leader_role_id && member.roles.cache.has(p.leader_role_id);
      const isDeputy = p.deputy_role_id && member.roles.cache.has(p.deputy_role_id);
      return isLeader || isDeputy;
    });

    if (filtered.length === 0) {
      await interaction.reply({ content: '✅ Aucune candidature en attente pour vos pôles.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Candidatures en attente d\'examen')
      .setColor(0xE5092E)
      .setDescription(
        filtered.map(p => {
          let line = `• <@${p.user_id}> pour le pôle **${p.dept_icon || '🔬'} ${p.dept_name}**`;
          if (p.availability) line += ` *(Dispo: ${p.availability})*`;
          if (p.motivation) line += `\n  > 🎯 *${p.motivation.slice(0, 100)}*`;
          return line;
        }).join('\n\n')
      )
      .setFooter({ text: 'Utilisez /departement valider [nom] @membre pour approuver' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // 5. Valider ou Refuser
  if (subcommand === 'valider' || subcommand === 'refuser') {
    const query = interaction.options.getString('nom', true).toLowerCase();
    const targetUser = interaction.options.getUser('membre', true);
    const dept = (await db.prepare(`
      SELECT * FROM departments 
      WHERE guild_id = ? AND (id = ? OR LOWER(name) LIKE ? OR LOWER(short_name) = ?)
    `).get(guildId, query, `%${query}%`, query)) as any;

    if (!dept) {
      await interaction.reply({ content: `❌ Pôle introuvable.`, ephemeral: true });
      return;
    }

    const operator = await interaction.guild.members.fetch(interaction.user.id);
    const isLeader = dept.leader_role_id && operator.roles.cache.has(dept.leader_role_id);
    const isDeputy = dept.deputy_role_id && operator.roles.cache.has(dept.deputy_role_id);
    const isAdmin = operator.permissions.has(PermissionFlagsBits.Administrator) || operator.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!isLeader && !isDeputy && !isAdmin) {
      await interaction.reply({
        content: `⛔ Vous devez être Chef, Adjoint du pôle **${dept.name}** ou Administrateur pour gérer les adhésions.`,
        ephemeral: true
      });
      return;
    }

    const isApprove = subcommand === 'valider';
    const newStatus = isApprove ? 'approved' : 'rejected';

    await db.prepare(`
      UPDATE department_members 
      SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
      WHERE department_id = ? AND user_id = ?
    `).run(newStatus, interaction.user.id, dept.id, targetUser.id);

    if (isApprove && dept.member_role_id) {
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (targetMember) {
        await targetMember.roles.add(dept.member_role_id, `Cortex : Candidature validée par ${interaction.user.tag}`).catch(() => null);
        await targetMember.send({
          content: `🎉 Félicitations ! Votre candidature au pôle **${dept.icon || '🔬'} ${dept.name}** a été acceptée par <@${interaction.user.id}> !`
        }).catch(() => null);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(isApprove ? '✅ Adhésion Validée' : '❌ Candidature Refusée')
      .setColor(isApprove ? 0x10B981 : 0xEF4444)
      .setDescription(
        isApprove
          ? `La candidature de <@${targetUser.id}> pour le pôle **${dept.icon || '🔬'} ${dept.name}** a été **approuvée** par <@${interaction.user.id}> !\nLe rôle Discord a été attribué avec succès.`
          : `La candidature de <@${targetUser.id}> pour le pôle **${dept.icon || '🔬'} ${dept.name}** a été **refusée**.`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }
}
