import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { ConfigService } from '../../services/configService.js';

export const data = new SlashCommandBuilder()
  .setName('backup')
  .setDescription('Gestion des sauvegardes de configuration')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('creer')
      .setDescription('Créer une sauvegarde instantanée de la configuration')
  )
  .addSubcommand(sub =>
    sub.setName('liste')
      .setDescription('Lister les sauvegardes disponibles')
  )
  .addSubcommand(sub =>
    sub.setName('restaurer')
      .setDescription('Restaurer la configuration depuis une sauvegarde')
      .addStringOption(opt => opt.setName('id').setDescription('ID de la sauvegarde').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const operator = { id: interaction.user.id, username: interaction.user.username };

  try {
    if (subcommand === 'creer') {
      const config = ConfigService.getGuildConfig(interaction.guild.id);
      if (!config) {
        await interaction.reply({ content: '❌ Aucune configuration active à sauvegarder.', ephemeral: true });
        return;
      }

      const res = ConfigService.saveGuildConfig(interaction.guild.id, config, operator);
      await interaction.reply({
        content: `✅ Sauvegarde créée avec succès : \`${res.backupPath}\``,
        ephemeral: true
      });
    } else if (subcommand === 'liste') {
      const backups = ConfigService.listBackups(interaction.guild.id);

      if (backups.length === 0) {
        await interaction.reply({ content: 'Aucune sauvegarde disponible pour ce serveur.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📦 Sauvegardes de Configuration')
        .setColor(0x3B82F6)
        .setDescription(
          backups.slice(0, 10).map(b => `• **${b.filename}** (ID: \`${b.id}\`)\n  Créée le ${new Date(b.createdAt).toLocaleString('fr-FR')} par ${b.createdBy}`).join('\n\n')
        )
        .setFooter({ text: 'Restaurez avec /backup restaurer id:<backupId>' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (subcommand === 'restaurer') {
      const backupId = interaction.options.getString('id', true);
      ConfigService.restoreBackup(interaction.guild.id, backupId, operator);

      await interaction.reply({
        content: `✅ Configuration restaurée avec succès depuis la sauvegarde \`${backupId}\` !`,
        ephemeral: true
      });
    }
  } catch (err: any) {
    await interaction.reply({ content: `❌ Erreur : ${err.message}`, ephemeral: true });
  }
}
