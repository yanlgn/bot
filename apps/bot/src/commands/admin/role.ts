import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { RoleService } from '../../services/roleService.js';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('Gestion des rôles du club scientifique')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(sub =>
    sub.setName('creer')
      .setDescription('Créer un nouveau rôle')
      .addStringOption(opt => opt.setName('nom').setDescription('Nom du rôle').setRequired(true))
      .addStringOption(opt => opt.setName('couleur').setDescription('Couleur hexadécimale (ex: #E11D48)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('attribuer')
      .setDescription('Attribuer un rôle à un membre')
      .addUserOption(opt => opt.setName('membre').setDescription('Membre cible').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Rôle à attribuer').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('retirer')
      .setDescription('Retirer un rôle à un membre')
      .addUserOption(opt => opt.setName('membre').setDescription('Membre cible').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Rôle à retirer').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const operatorMember = await interaction.guild.members.fetch(interaction.user.id);
  const operator = { id: interaction.user.id, username: interaction.user.username, member: operatorMember };

  try {
    if (subcommand === 'creer') {
      const name = interaction.options.getString('nom', true);
      const color = interaction.options.getString('couleur') || '#64748B';

      const role = await RoleService.createRole(interaction.guild, { name, color, hoist: false, mentionable: false, permissions: [] }, operator);
      await interaction.reply({ content: `✅ Rôle <@&${role.id}> créé avec succès !`, ephemeral: true });
    } else if (subcommand === 'attribuer') {
      const targetUser = interaction.options.getUser('membre', true);
      const role = interaction.options.getRole('role', true);

      await RoleService.toggleRoleMember(interaction.guild, targetUser.id, role.id, 'add', operator);
      await interaction.reply({ content: `✅ Rôle <@&${role.id}> attribué à <@${targetUser.id}>.`, ephemeral: true });
    } else if (subcommand === 'retirer') {
      const targetUser = interaction.options.getUser('membre', true);
      const role = interaction.options.getRole('role', true);

      await RoleService.toggleRoleMember(interaction.guild, targetUser.id, role.id, 'remove', operator);
      await interaction.reply({ content: `✅ Rôle <@&${role.id}> retiré à <@${targetUser.id}>.`, ephemeral: true });
    }
  } catch (err: any) {
    await interaction.reply({ content: `❌ Erreur : ${err.message}`, ephemeral: true });
  }
}
