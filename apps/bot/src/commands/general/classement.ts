import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { PointsService } from '../../services/pointsService.js';

export const data = new SlashCommandBuilder()
  .setName('classement')
  .setDescription('Affiche le Top 10 des membres les plus engagés du club scientifique');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const leaderboard = await PointsService.getLeaderboard(interaction.guild.id, 10);

  if (leaderboard.length === 0) {
    await interaction.reply({
      content: 'ℹ️ Aucun point n\'a encore été enregistré. Participez aux projets, ateliers et discussions scientifiques pour grimper dans le classement !',
      ephemeral: true
    });
    return;
  }

  const userBalance = await PointsService.getBalance(interaction.guild.id, interaction.user.id);
  const userRankIndex = leaderboard.findIndex(e => e.userId === interaction.user.id);
  const userRankStr = userRankIndex >= 0 ? `#${userRankIndex + 1}` : 'Hors Top 10';

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const lines = leaderboard.map((entry, index) => {
    const icon = medals[index] || `**#${index + 1}**`;
    const isCaller = entry.userId === interaction.user.id;
    const highlight = isCaller ? '👉 ' : '';
    return `${highlight}${icon} <@${entry.userId}> • **${entry.balance}** points`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 CORTEX Scientific Club — Tableau d\'Honneur')
    .setColor(0xE5092E)
    .setDescription(
      'Félicitations aux membres les plus actifs pour leur contribution scientifique, leurs projets et leur implication :\n\n' +
      lines.join('\n')
    )
    .addFields({
      name: '🎯 Votre position',
      value: `Vous possédez **${userBalance}** point(s) • Rang actuel : **${userRankStr}**`,
      inline: false
    })
    .setFooter({ text: 'CORTEX Scientific Club • Gagnez des points en contribuant aux projets et ateliers' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
