import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ProjectService } from '../../services/projectService.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('projet')
  .setDescription('Gestion des projets scientifiques du club')
  .addSubcommand(sub =>
    sub.setName('creer')
      .setDescription('Créer un nouveau projet scientifique et son salon de travail')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom du projet').setRequired(true))
      .addStringOption(opt => opt.setName('description').setDescription('Description des objectifs').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('liste')
      .setDescription('Lister tous les projets scientifiques en cours')
  )
  .addSubcommand(sub =>
    sub.setName('rejoindre')
      .setDescription('Rejoindre l\'équipe d\'un projet')
      .addStringOption(opt => opt.setName('id').setDescription('ID du projet à rejoindre').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'creer') {
    await interaction.deferReply();
    const name = interaction.options.getString('nom', true);
    const description = interaction.options.getString('description', true);

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

      const embed = new EmbedBuilder()
        .setTitle(`🚀 Projet Créé : ${project.name}`)
        .setDescription(project.description)
        .setColor(0x3B82F6)
        .addFields(
          { name: 'Chef de Projet', value: `<@${project.leaderId}>`, inline: true },
          { name: 'Statut', value: '💡 En phase d\'idéation', inline: true },
          { name: 'Salon dédié', value: project.channelId ? `<#${project.channelId}>` : 'Aucun', inline: true }
        )
        .setFooter({ text: `ID Projet : ${project.id}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      await interaction.editReply({ content: `❌ Erreur : ${error.message}` });
    }
  } else if (subcommand === 'liste') {
    const projects = ProjectService.getProjects(interaction.guild.id);

    if (projects.length === 0) {
      await interaction.reply({ content: 'Aucun projet scientifique n\'est actuellement enregistré.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🚀 Projets Scientifiques du Club')
      .setColor(0x06B6D4)
      .setDescription('Voici les projets en cours dans notre club :');

    for (const p of projects.slice(0, 10)) {
      embed.addFields({
        name: `${p.name} (${p.status.toUpperCase()})`,
        value: `${p.description.slice(0, 150)}...\n**Leader :** <@${p.leaderId}> • **Membres :** ${p.memberIds.length}\n*Rejoindre avec:* \`/projet rejoindre id:${p.id}\``
      });
    }

    await interaction.reply({ embeds: [embed] });
  } else if (subcommand === 'rejoindre') {
    const projectId = interaction.options.getString('id', true);
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND guild_id = ?').get(projectId, interaction.guild.id) as any;

    if (!project) {
      await interaction.reply({ content: '❌ Projet introuvable.', ephemeral: true });
      return;
    }

    try {
      db.prepare(`
        INSERT INTO project_members (project_id, user_id, role, joined_at)
        VALUES (?, ?, 'contributor', datetime('now'))
      `).run(projectId, interaction.user.id);

      // Si le projet a un salon dédié, donner l'accès au membre
      if (project.channel_id) {
        const channel = await interaction.guild.channels.fetch(project.channel_id).catch(() => null);
        if (channel && 'permissionOverwrites' in channel) {
          await (channel as any).permissionOverwrites.edit(interaction.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          }).catch(() => null);
        }
      }

      await interaction.reply({
        content: `🎉 Félicitations ! Vous avez rejoint l'équipe du projet **${project.name}** !`,
        ephemeral: true
      });
    } catch {
      await interaction.reply({ content: 'Vous êtes déjà membre de ce projet.', ephemeral: true });
    }
  }
}
