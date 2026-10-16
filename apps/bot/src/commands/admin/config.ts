import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { ConfigService } from '../../services/configService.js';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Afficher ou recharger la configuration déclarative JSON du serveur')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub =>
    sub.setName('afficher')
      .setDescription('Affiche le résumé de la configuration active du club')
  )
  .addSubcommand(sub =>
    sub.setName('recharger')
      .setDescription('Recharge et valide à chaud le fichier de configuration JSON')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'afficher') {
    const config = ConfigService.getGuildConfig(interaction.guild.id);
    if (!config) {
      await interaction.reply({
        content: `❌ Aucun fichier de configuration trouvé pour ce serveur (Fichier attendu : \`${interaction.guild.id}.json\`).`,
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Configuration SciClub : ${config.club.name}`)
      .setColor(0x3B82F6)
      .setDescription(config.club.description)
      .addFields(
        { name: '🌐 Langue & Timezone', value: `${config.locale} / ${config.timezone}`, inline: true },
        { name: '👥 Rôles Déclarés', value: `${Object.keys(config.roles).length} rôles`, inline: true },
        { name: '📁 Canaux Configurés', value: `${Object.keys(config.channels).length} canaux`, inline: true },
        {
          name: '🛡️ Modération',
          value: `Max warnings: **${config.moderation.maxWarnings}** • Auto-mute: **${config.moderation.autoMuteDurationMinutes}m**`
        },
        {
          name: '✨ Système de Points',
          value: config.points.enabled
            ? `Actif (Message: +${config.points.messagePoints}, Projet: +${config.points.projectCreationPoints}, Événement: +${config.points.eventParticipationPoints})`
            : 'Désactivé'
        }
      )
      .setFooter({ text: 'Pour modifier la configuration, utilisez le Dashboard Web ou éditez le fichier JSON.' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else if (subcommand === 'recharger') {
    try {
      const config = ConfigService.getGuildConfig(interaction.guild.id);
      if (!config) {
        throw new Error('Fichier de configuration inexistant.');
      }
      await interaction.reply({
        content: `✅ Configuration rechargée et validée avec succès pour **${config.club.name}** !`,
        ephemeral: true
      });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Erreur lors de la validation du fichier JSON : ${err.message}`,
        ephemeral: true
      });
    }
  }
}
