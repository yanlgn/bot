import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, CategoryChannel } from 'discord.js';
import { ConfigService } from '../../services/configService.js';
import { RoleService } from '../../services/roleService.js';
import { ChannelService } from '../../services/channelService.js';
import { PermissionService } from '../../services/permissionService.js';

export const data = new SlashCommandBuilder()
  .setName('sync')
  .setDescription('Synchronise entièrement le serveur Discord selon le fichier de configuration JSON')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const config = ConfigService.getGuildConfig(interaction.guild.id);
  if (!config) {
    await interaction.editReply({
      content: `❌ Aucun fichier de configuration trouvé (\`${interaction.guild.id}.json\`).`
    });
    return;
  }

  const operatorMember = await interaction.guild.members.fetch(interaction.user.id);
  const operator = { id: interaction.user.id, username: interaction.user.username, member: operatorMember };

  const logs: string[] = [];

  try {
    // 1. Synchronisation des catégories déclarées
    const existingChannels = await interaction.guild.channels.fetch();
    const existingCategories = existingChannels.filter(c => c && c.type === ChannelType.GuildCategory);
    const categoryKeyToId = new Map<string, string>();

    for (const cat of config.categories) {
      let found = existingCategories.find(c => c && c.name.toLowerCase() === cat.name.toLowerCase()) as CategoryChannel | undefined;
      if (!found) {
        found = await interaction.guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          reason: 'SciClub Sync : Création de la catégorie configurée'
        });
        logs.push(`📁 Catégorie créée : "${cat.name}"`);
      }
      categoryKeyToId.set(cat.key, found.id);
    }

    // 2. Synchronisation des rôles déclarés
    const existingRoles = await interaction.guild.roles.fetch();
    const roleKeyToId = new Map<string, string>();

    for (const [key, roleDef] of Object.entries(config.roles)) {
      let found = existingRoles.find(r => r.name.toLowerCase() === roleDef.name.toLowerCase());
      if (!found) {
        found = await RoleService.createRole(
          interaction.guild,
          {
            name: roleDef.name,
            color: roleDef.color,
            hoist: true,
            mentionable: true,
            permissions: roleDef.permissions
          },
          operator
        );
        logs.push(`🏷️ Rôle créé : "${roleDef.name}"`);
      }
      roleKeyToId.set(`role:${key}`, found.id);
    }

    // 3. Synchronisation des salons déclarés
    const currentChannels = await interaction.guild.channels.fetch();
    const channelKeyToId = new Map<string, string>();

    for (const [key, chDef] of Object.entries(config.channels)) {
      const found = currentChannels.find(c => c && c.name.toLowerCase() === chDef.name.toLowerCase());
      const parentId = chDef.categoryKey ? categoryKeyToId.get(chDef.categoryKey) || null : null;

      if (!found) {
        const created = await ChannelService.createChannel(
          interaction.guild,
          {
            name: chDef.name,
            type: chDef.type,
            parentId,
            topic: chDef.topic,
            rateLimitPerUser: 0,
            nsfw: false
          },
          operator
        );
        logs.push(`💬 Salon créé : #${chDef.name}`);
        channelKeyToId.set(key, created.id);
      } else {
        channelKeyToId.set(key, found.id);
      }
    }

    // 4. Synchronisation des permissions de salon
    if (config.channelPermissions) {
      for (const rule of config.channelPermissions) {
        const channelId = channelKeyToId.get(rule.channelKey);
        if (!channelId) continue;

        for (const overwrite of rule.overwrites) {
          const resolvedTargetId = roleKeyToId.get(overwrite.targetKey) || (overwrite.targetKey.startsWith('role:') ? null : overwrite.targetKey);
          if (!resolvedTargetId) continue;

          await PermissionService.updateChannelPermissions(
            interaction.guild,
            channelId,
            {
              targetId: resolvedTargetId,
              targetType: 'role',
              permissions: overwrite.permissions
            },
            operator
          ).catch(() => null);
        }
      }
      logs.push('🔒 Permissions déclaratives appliquées aux salons');
    }

    await interaction.editReply({
      content: `✅ **Synchronisation terminée avec succès !**\n\n${logs.length > 0 ? logs.join('\n') : 'Tout est déjà parfaitement synchronisé avec la configuration.'}`
    });
  } catch (err: any) {
    await interaction.editReply({ content: `❌ Erreur pendant la synchronisation : ${err.message}` });
  }
}
