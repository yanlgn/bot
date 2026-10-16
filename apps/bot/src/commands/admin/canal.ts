import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ChannelService } from '../../services/channelService.js';

export const data = new SlashCommandBuilder()
  .setName('canal')
  .setDescription('Gestion des salons du serveur')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand(sub =>
    sub.setName('creer')
      .setDescription('Créer un nouveau salon')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom du salon').setRequired(true))
      .addStringOption(opt =>
        opt.setName('type')
          .setDescription('Type de salon')
          .setRequired(true)
          .addChoices(
            { name: 'Texte', value: 'text' },
            { name: 'Vocal', value: 'voice' },
            { name: 'Catégorie', value: 'category' }
          )
      )
      .addChannelOption(opt => opt.setName('categorie').setDescription('Catégorie parente').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('supprimer')
      .setDescription('Supprimer un salon existant')
      .addChannelOption(opt => opt.setName('canal').setDescription('Salon à supprimer').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const operator = { id: interaction.user.id, username: interaction.user.username };

  try {
    if (subcommand === 'creer') {
      const name = interaction.options.getString('nom', true);
      const type = interaction.options.getString('type', true) as any;
      const category = interaction.options.getChannel('categorie');

      const created = await ChannelService.createChannel(
        interaction.guild,
        {
          name,
          type,
          parentId: category ? category.id : null,
          rateLimitPerUser: 0,
          nsfw: false
        },
        operator
      );

      await interaction.reply({ content: `✅ Salon <#${created.id}> créé avec succès !`, ephemeral: true });
    } else if (subcommand === 'supprimer') {
      const channel = interaction.options.getChannel('canal', true);
      await ChannelService.deleteChannel(interaction.guild, channel.id, operator);
      await interaction.reply({ content: `✅ Salon #${channel.name} supprimé avec succès.`, ephemeral: true });
    }
  } catch (err: any) {
    await interaction.reply({ content: `❌ Erreur : ${err.message}`, ephemeral: true });
  }
}
