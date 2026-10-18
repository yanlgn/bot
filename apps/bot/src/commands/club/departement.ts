import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('departement')
  .setDescription('Gestion des départements (pôles scientifiques) de CORTEX')
  .addSubcommand(sub =>
    sub.setName('liste')
      .setDescription('Afficher la liste des pôles scientifiques du club')
  )
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('Consulter les détails d\'un pôle scientifique')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom ou ID du pôle').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('rejoindre')
      .setDescription('Soumettre une demande d\'adhésion à un pôle scientifique')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom ou ID du pôle à rejoindre').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('demandes')
      .setDescription('Consulter les candidatures en attente pour un pôle (Responsables / Admins)')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom ou ID du pôle').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('valider')
      .setDescription('Approuver l\'adhésion d\'un membre à votre pôle')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom ou ID du pôle').setRequired(true))
      .addUserOption(opt => opt.setName('membre').setDescription('Membre à intégrer').setRequired(true))
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

  if (subcommand === 'liste') {
    const departments = db.prepare(`
      SELECT d.*, 
        (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id AND dm.status = 'approved') as members_count,
        (SELECT COUNT(*) FROM projects p WHERE p.department_id = d.id) as projects_count
      FROM departments d
      WHERE d.guild_id = ? AND d.is_archived = 0
      ORDER BY d.created_at ASC
    `).all(guildId) as any[];

    if (departments.length === 0) {
      await interaction.reply({
        content: 'ℹ️ Aucun pôle scientifique n\'a encore été créé sur ce serveur. Configurez-les depuis le Dashboard Web Cortex.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🔬 Départements & Pôles Scientifiques — CORTEX')
      .setDescription('Voici les pôles de recherche et d\'innovation actifs dans le club :')
      .setColor(0xE5092E)
      .setFooter({ text: 'CORTEX Scientific Club • Utilisez /departement rejoindre pour postuler' });

    for (const d of departments) {
      const leaderRole = d.leader_role_id ? `<@&${d.leader_role_id}>` : 'Non assigné';
      const category = d.category_id ? `<#${d.category_id}>` : 'Non définie';
      embed.addFields({
        name: `${d.icon || '🔬'} ${d.name} (${d.short_name || d.id})`,
        value: `${d.description ? d.description + '\n' : ''}👥 **${d.members_count} membre(s)** • 💡 **${d.projects_count} projet(s)**\n🎖️ Responsable : ${leaderRole} • 📁 Catégorie : ${category}`,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (subcommand === 'info') {
    const query = interaction.options.getString('nom', true).toLowerCase();
    const dept = db.prepare(`
      SELECT d.*, 
        (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id AND dm.status = 'approved') as members_count
      FROM departments d
      WHERE d.guild_id = ? AND (d.id = ? OR LOWER(d.name) LIKE ? OR LOWER(d.short_name) = ?)
    `).get(guildId, query, `%${query}%`, query) as any;

    if (!dept) {
      await interaction.reply({ content: `❌ Pôle introuvable avec la recherche "${query}". Tapez \`/departement liste\`.`, ephemeral: true });
      return;
    }

    const projects = db.prepare('SELECT id, name, status FROM projects WHERE department_id = ? LIMIT 5').all(dept.id) as any[];
    const embed = new EmbedBuilder()
      .setTitle(`${dept.icon || '🔬'} Pôle : ${dept.name}`)
      .setDescription(dept.description || 'Aucune description renseignée.')
      .setColor(dept.color ? parseInt(dept.color.replace('#', ''), 16) : 0xE5092E)
      .addFields(
        { name: '👥 Membres actifs', value: `${dept.members_count} membre(s)`, inline: true },
        { name: '🎖️ Rôle Chef', value: dept.leader_role_id ? `<@&${dept.leader_role_id}>` : 'Aucun', inline: true },
        { name: '👥 Rôle Membre', value: dept.member_role_id ? `<@&${dept.member_role_id}>` : 'Aucun', inline: true },
        {
          name: '🚀 Projets récents',
          value: projects.length > 0 ? projects.map(p => `• **${p.name}** (${p.status})`).join('\n') : 'Aucun projet rattaché pour le moment.'
        }
      )
      .setFooter({ text: `ID: ${dept.id}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (subcommand === 'rejoindre') {
    const query = interaction.options.getString('nom', true).toLowerCase();
    const dept = db.prepare(`
      SELECT * FROM departments 
      WHERE guild_id = ? AND is_archived = 0 AND (id = ? OR LOWER(name) LIKE ? OR LOWER(short_name) = ?)
    `).get(guildId, query, `%${query}%`, query) as any;

    if (!dept) {
      await interaction.reply({ content: `❌ Pôle introuvable. Tapez \`/departement liste\` pour voir les pôles disponibles.`, ephemeral: true });
      return;
    }

    const existing = db.prepare('SELECT * FROM department_members WHERE department_id = ? AND user_id = ?').get(dept.id, interaction.user.id) as any;
    if (existing) {
      if (existing.status === 'approved') {
        await interaction.reply({ content: `✅ Vous êtes déjà membre officiel du pôle **${dept.name}** !`, ephemeral: true });
        return;
      }
      if (existing.status === 'pending') {
        await interaction.reply({ content: `⏳ Votre candidature pour le pôle **${dept.name}** est déjà en attente d'approbation.`, ephemeral: true });
        return;
      }
    }

    db.prepare(`
      INSERT INTO department_members (department_id, guild_id, user_id, role, status, requested_at)
      VALUES (?, ?, ?, 'member', 'pending', datetime('now'))
      ON CONFLICT(department_id, user_id) DO UPDATE SET status = 'pending', requested_at = datetime('now')
    `).run(dept.id, guildId, interaction.user.id);

    await interaction.reply({
      content: `📨 Votre candidature pour rejoindre le pôle **${dept.icon || '🔬'} ${dept.name}** a été soumise avec succès !\nLe Chef de Pôle ou un Administrateur examinera votre demande.`,
      ephemeral: true
    });
    return;
  }

  if (subcommand === 'demandes') {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild);

    const pending = db.prepare(`
      SELECT dm.*, d.name as dept_name, d.icon as dept_icon, d.leader_role_id
      FROM department_members dm
      JOIN departments d ON d.id = dm.department_id
      WHERE dm.guild_id = ? AND dm.status = 'pending'
      ORDER BY dm.requested_at ASC
    `).all(guildId) as any[];

    // Filtrer pour les chefs de pôle si non admin
    const filtered = pending.filter(p => {
      if (isAdmin) return true;
      return p.leader_role_id && member.roles.cache.has(p.leader_role_id);
    });

    if (filtered.length === 0) {
      await interaction.reply({ content: '✅ Aucune candidature en attente pour vos pôles.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Candidatures en attente d\'examen')
      .setColor(0xE5092E)
      .setDescription(
        filtered.map(p => `• <@${p.user_id}> pour le pôle **${p.dept_icon || '🔬'} ${p.dept_name}**\n  *Date : ${p.requested_at}*`).join('\n\n')
      )
      .setFooter({ text: 'Utilisez /departement valider [nom] @membre pour approuver' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (subcommand === 'valider' || subcommand === 'refuser') {
    const query = interaction.options.getString('nom', true).toLowerCase();
    const targetUser = interaction.options.getUser('membre', true);
    const dept = db.prepare(`
      SELECT * FROM departments 
      WHERE guild_id = ? AND (id = ? OR LOWER(name) LIKE ? OR LOWER(short_name) = ?)
    `).get(guildId, query, `%${query}%`, query) as any;

    if (!dept) {
      await interaction.reply({ content: `❌ Pôle introuvable.`, ephemeral: true });
      return;
    }

    const operator = await interaction.guild.members.fetch(interaction.user.id);
    const isLeader = dept.leader_role_id && operator.roles.cache.has(dept.leader_role_id);
    const isAdmin = operator.permissions.has(PermissionFlagsBits.Administrator) || operator.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!isLeader && !isAdmin) {
      await interaction.reply({
        content: `⛔ Vous devez être Chef du pôle **${dept.name}** ou Administrateur pour gérer les adhésions.`,
        ephemeral: true
      });
      return;
    }

    const isApprove = subcommand === 'valider';
    const newStatus = isApprove ? 'approved' : 'rejected';

    db.prepare(`
      UPDATE department_members 
      SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
      WHERE department_id = ? AND user_id = ?
    `).run(newStatus, interaction.user.id, dept.id, targetUser.id);

    if (isApprove && dept.member_role_id) {
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (targetMember) {
        await targetMember.roles.add(dept.member_role_id, `Cortex : Candidature validée par ${interaction.user.username}`).catch(() => null);
      }
    }

    await interaction.reply({
      content: isApprove
        ? `🎉 La candidature de <@${targetUser.id}> pour le pôle **${dept.name}** a été **validée** avec succès ! Le rôle Discord lui a été attribué.`
        : `🚫 La candidature de <@${targetUser.id}> pour le pôle **${dept.name}** a été **refusée**.`
    });
    return;
  }
}
