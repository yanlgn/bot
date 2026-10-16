import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { PermissionService } from '../../services/permissionService.js';

export const data = new SlashCommandBuilder()
  .setName('permission')
  .setDescription('Gestion des permissions spécifiques par salon')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand(sub =>
    sub.setName('ajouter')
      .setDescription('Définir une permission pour un rôle sur un salon')
      .addChannelOption(opt => opt.setName('canal').setDescription('Salon ciblé').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Rôle ciblé').setRequired(true))
      .addStringOption(opt =>
        opt.setName('permission')
          .setDescription('Permission à configurer')
          .setRequired(true)
          .addChoices(
            { name: 'Voir le salon (ViewChannel)', value: 'ViewChannel' },
            { name: 'Envoyer des messages (SendMessages)', value: 'SendMessages' },
            { name: 'Lire l\'historique (ReadMessageHistory)', value: 'ReadMessageHistory' },
            { name: 'Gérer les messages (ManageMessages)', value: 'ManageMessages' },
            { name: 'Joindre des fichiers (AttachFiles)', value: 'AttachFiles' }
          )
      )
      .addStringOption(opt =>
        opt.setName('etat')
          .setDescription('État de la permission')
          .setRequired(true)
          .addChoices(
            { name: 'Autorisé (ALLOW)', value: 'ALLOW' },
            { name: 'Refusé (DENY)', value: 'DENY' }
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('retirer')
      .setDescription('Réinitialiser les permissions d\'un rôle sur un salon (Neutre)')
      .addChannelOption(opt => opt.setName('canal').setDescription('Salon ciblé').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Rôle ciblé').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const operator = { id: interaction.user.id, username: interaction.user.username };

  try {
    if (subcommand === 'ajouter') {
      const channel = interaction.options.getChannel('canal', true);
      const role = interaction.options.getRole('role', true);
      const perm = interaction.options.getString('permission', true);
      const state = interaction.options.getString('etat', true) as 'ALLOW' | 'DENY';

      await PermissionService.updateChannelPermissions(
        interaction.guild,
        channel.id,
        {
          targetId: role.id,
          targetType: 'role',
          permissions: { [perm]: state }
        },
        operator
      );

      await interaction.reply({
        content: `✅ Permission **${perm}** configurée sur **${state}** pour <@&${role.id}> dans <#${channel.id}>.`,
        ephemeral: true
      });
    } else if (subcommand === 'retirer') {
      const channel = interaction.options.getChannel('canal', true);
      const role = interaction.options.getRole('role', true);

      await PermissionService.deleteChannelPermission(interaction.guild, channel.id, role.id, operator);
      await interaction.reply({
        content: `✅ Overwrite réinitialisé pour <@&${role.id}> dans <#${channel.id}>.`,
        ephemeral: true
      });
    }
  } catch (err: any) {
    await interaction.reply({ content: `❌ Erreur : ${err.message}`, ephemeral: true });
  }
}
