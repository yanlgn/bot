import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ProjectService } from '../../services/projectService.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('projet')
  .setDescription('Gestion des projets de recherche et d\'ingénierie CORTEX')
  .addSubcommand(sub =>
    sub.setName('creer')
      .setDescription('Créer un nouveau projet scientifique et son salon de travail')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom du projet').setRequired(true))
      .addStringOption(opt => opt.setName('description').setDescription('Objectifs et résumé du projet').setRequired(true))
      .addStringOption(opt => opt.setName('pole').setDescription('Nom ou ID du pôle associé (ex: IA, Robotique)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('liste')
      .setDescription('Afficher la liste des projets scientifiques en cours')
  )
  .addSubcommand(sub =>
    sub.setName('rejoindre')
      .setDescription('Intégrer l\'équipe de recherche d\'un projet')
      .addStringOption(opt => opt.setName('id').setDescription('Identifiant du projet').setRequired(true))
  );

const STATUS_LABELS: Record<string, string> = {
  idea: '💡 Idée / Ébauche',
  in_progress: '🟢 En développement actif',
  paused: '⏸️ En pause',
  completed: '🏁 Terminé avec succès',
  archived: '🗄️ Archivé'
};

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'creer') {
    await interaction.deferReply();
    const name = interaction.options.getString('nom', true);
    const description = interaction.options.getString('description', true);
    const poleQuery = interaction.options.getString('pole')?.toLowerCase();

    let departmentId: string | undefined = undefined;
    if (poleQuery) {
      const dept = db.prepare(`
        SELECT id, name FROM departments 
        WHERE guild_id = ? AND (id = ? OR LOWER(name) LIKE ? OR LOWER(short_name) = ?)
      `).get(interaction.guild.id, poleQuery, `%${poleQuery}%`, poleQuery) as any;
      if (dept) departmentId = dept.id;
    }

    try {
      const project = await ProjectService.createProject(
        interaction.guild,
        {
          name,
          description,
          leaderId: interaction.user.id,
          memberIds: [],
          createChannel: true
        },
        { id: interaction.user.id, username: interaction.user.username }
      );

      if (departmentId) {
        db.prepare('UPDATE projects SET department_id = ? WHERE id = ?').run(departmentId, project.id);
      }

      const embed = new EmbedBuilder()
        .setTitle(`🚀 Nouveau Projet Lancé : ${project.name}`)
        .setDescription(project.description)
        .setColor(0xE5092E)
        .addFields(
          { name: '👑 Responsable', value: `<@${project.leaderId}>`, inline: true },
          { name: '📊 Statut', value: STATUS_LABELS[project.status] || project.status, inline: true },
          { name: '💬 Salon dédié', value: project.channelId ? `<#${project.channelId}>` : '*Aucun*', inline: true }
        )
        .setFooter({ text: `ID Projet : ${project.id} • CORTEX Scientific Club` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      await interaction.editReply({ content: `❌ Impossible de créer le projet : ${error.message}` });
    }
  } else if (subcommand === 'liste') {
    const projects = ProjectService.getProjects(interaction.guild.id);

    if (projects.length === 0) {
      await interaction.reply({
        content: 'ℹ️ Aucun projet scientifique n\'est actuellement enregistré. Utilisez `/projet creer` pour initier le premier !',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🚀 CORTEX Scientific Club — Projets Actifs')
      .setColor(0xE5092E)
      .setDescription('Voici les projets de recherche et d\'innovation portés par les membres :\n');

    for (const p of projects.slice(0, 10)) {
      const statusText = STATUS_LABELS[p.status] || p.status;
      embed.addFields({
        name: `• ${p.name} — ${statusText}`,
        value: `${p.description.slice(0, 160)}${p.description.length > 160 ? '...' : ''}\n👑 **Leader :** <@${p.leaderId}> • 👥 **${p.memberIds.length} collaborateur(s)**\n👉 *Rejoindre :* \`/projet rejoindre id:${p.id}\``,
        inline: false
      });
    }

    embed.setFooter({ text: 'CORTEX Scientific Club • Rejoignez des projets pour accumuler des points' });
    await interaction.reply({ embeds: [embed] });
  } else if (subcommand === 'rejoindre') {
    const projectId = interaction.options.getString('id', true);
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND guild_id = ?').get(projectId, interaction.guild.id) as any;

    if (!project) {
      await interaction.reply({ content: `❌ Projet introuvable avec l'ID "${projectId}". Tapez \`/projet liste\`.`, ephemeral: true });
      return;
    }

    // Vérifier si déjà membre
    const existing = db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, interaction.user.id);
    if (existing) {
      await interaction.reply({ content: `✅ Vous participez déjà au projet **${project.name}** !`, ephemeral: true });
      return;
    }

    try {
      db.prepare(`
        INSERT INTO project_members (project_id, user_id, role, joined_at)
        VALUES (?, ?, 'contributor', datetime('now'))
      `).run(projectId, interaction.user.id);

      // Donner accès au salon
      if (project.channel_id) {
        const channel = await interaction.guild.channels.fetch(project.channel_id).catch(() => null);
        if (channel && 'permissionOverwrites' in channel) {
          await channel.permissionOverwrites.create(interaction.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true
          }).catch(() => null);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🎉 Bienvenue dans l\'équipe !')
        .setColor(0x10B981)
        .setDescription(`Vous avez rejoint le projet **${project.name}** dirigé par <@${project.leader_id}> !${project.channel_id ? `\nAccédez au salon de travail : <#${project.channel_id}>` : ''}`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Erreur : ${err.message}`, ephemeral: true });
    }
  }
}
