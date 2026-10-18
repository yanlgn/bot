import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { PointsService } from '../../services/pointsService.js';

export const data = new SlashCommandBuilder()
  .setName('classement')
  .setDescription('Affiche le classement des membres les plus actifs du club scientifique');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const leaderboard = PointsService.getLeaderboard(interaction.guild.id, 10);

  if (leaderboard.length === 0) {
    await interaction.reply({
      content: 'Aucun point n\'a encore été enregistré sur ce serveur. Participez aux projets et événements pour monter dans le classement !',
      ephemeral: true
    });
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = leaderboard.map((entry, index) => {
    const medal = medals[index] || `**#${index + 1}**`;
    return `${medal} <@${entry.userId}> — **${entry.balance}** points`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 Classement CORTEX Scientific Club')
    .setColor(0xE5092E)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: 'CORTEX • Les points récompensent les projets, messages et participations aux événements.' });

  await interaction.reply({ embeds: [embed] });
}
