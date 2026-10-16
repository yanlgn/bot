import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { PointsService } from '../../services/pointsService.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('profil')
  .setDescription('Affiche votre profil scientifique, points et projets')
  .addUserOption(option =>
    option.setName('membre')
      .setDescription('Le membre dont vous souhaitez voir le profil (vous-même par défaut)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const targetUser = interaction.options.getUser('membre') || interaction.user;
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

  const balance = PointsService.getBalance(interaction.guild.id, targetUser.id);

  // Projets rejoints ou dirigés
  const projectsCount = db.prepare(`
    SELECT COUNT(DISTINCT project_id) as count FROM project_members WHERE user_id = ?
  `).get(targetUser.id) as { count: number };

  // Événements auxquels le membre a participé
  const eventsCount = db.prepare(`
    SELECT COUNT(*) as count FROM event_participants WHERE user_id = ?
  `).get(targetUser.id) as { count: number };

  // Badges calculés selon les points
  const badges: string[] = [];
  if (balance >= 100) badges.push('🏆 Savant Émérite');
  else if (balance >= 50) badges.push('🔬 Chercheur Confirmé');
  else if (balance >= 20) badges.push('🧪 Expérimentateur');
  else badges.push('🌱 Apprenti Scientifique');

  if (projectsCount.count > 0) badges.push('🚀 Bâtisseur de Projet');
  if (eventsCount.count >= 3) badges.push('📅 Pilier des Ateliers');

  const embed = new EmbedBuilder()
    .setTitle(`Profil Scientifique de ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL())
    .setColor(0x10B981)
    .addFields(
      { name: '✨ Points de Participation', value: `**${balance}** pts`, inline: true },
      { name: '🚀 Projets Actifs', value: `${projectsCount.count}`, inline: true },
      { name: '📅 Événements Rejoints', value: `${eventsCount.count}`, inline: true },
      { name: '🎖️ Titres & Badges', value: badges.join('\n') || 'Aucun badge' },
      {
        name: '🏷️ Rôles du Club',
        value: targetMember
          ? targetMember.roles.cache
              .filter(r => r.id !== interaction.guild!.id)
              .map(r => `<@&${r.id}>`)
              .slice(0, 8)
              .join(', ') || 'Aucun rôle'
          : 'Inconnu'
      }
    )
    .setFooter({ text: 'SciClub Manager' });

  await interaction.reply({ embeds: [embed] });
}
