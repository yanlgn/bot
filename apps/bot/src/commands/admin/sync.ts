import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, CategoryChannel, EmbedBuilder } from 'discord.js';
import { ConfigService } from '../../services/configService.js';
import { RoleService } from '../../services/roleService.js';
import { ChannelService } from '../../services/channelService.js';
import { PermissionService } from '../../services/permissionService.js';
import { hexToDecimalColor, normalizeDiscordName, sanitizeChannelName } from '@sciclub/shared';

export const data = new SlashCommandBuilder()
  .setName('sync')
  .setDescription('Synchronise entièrement le serveur Discord selon le fichier de configuration JSON CORTEX')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const config = ConfigService.getGuildConfig(interaction.guild.id);
  if (!config) {
    await interaction.editReply({
      content: `❌ Aucun fichier de configuration trouvé pour ce serveur (\`${interaction.guild.id}.json\`). Ouvrez le Dashboard Web CORTEX pour l'initialiser.`
    });
    return;
  }

  const operatorMember = await interaction.guild.members.fetch(interaction.user.id);
  const operator = { id: interaction.user.id, username: interaction.user.username, member: operatorMember };
  const botMember = await interaction.guild.members.fetchMe();

  const logs: string[] = [];

  try {
    // 1. Synchronisation des catégories déclarées
    const existingChannels = await interaction.guild.channels.fetch();
    const existingCategories = existingChannels.filter(c => c && c.type === ChannelType.GuildCategory);
    const categoryKeyToId = new Map<string, string>();

    for (const cat of config.categories) {
      let found = existingCategories.find(c => 
        c && (
          c.name.toLowerCase() === cat.name.toLowerCase() ||
          normalizeDiscordName(c.name) === normalizeDiscordName(cat.name)
        )
      ) as CategoryChannel | undefined;

      if (!found) {
        found = await interaction.guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          reason: 'CORTEX Sync : Création de la catégorie configurée'
        });
        logs.push(`📁 Catégorie : "${cat.name}" créée`);
        existingChannels.set(found.id, found);
      }
      categoryKeyToId.set(cat.key, found.id);
    }

    // 2. Synchronisation des rôles déclarés
    const existingRoles = await interaction.guild.roles.fetch();
    const roleKeyToId = new Map<string, string>();

    for (const [key, roleDef] of Object.entries(config.roles)) {
      let found = existingRoles.find(r => 
        r.name.toLowerCase() === roleDef.name.toLowerCase() ||
        normalizeDiscordName(r.name) === normalizeDiscordName(roleDef.name)
      );

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
        logs.push(`🏷️ Rôle : "${roleDef.name}" créé`);
      }
      roleKeyToId.set(`role:${key}`, found.id);
    }

    // 3. Synchronisation des salons déclarés
    const currentChannels = await interaction.guild.channels.fetch();
    const channelKeyToId = new Map<string, string>();

    for (const [key, chDef] of Object.entries(config.channels)) {
      const targetNorm = normalizeDiscordName(chDef.name);
      const parentId = chDef.categoryKey ? categoryKeyToId.get(chDef.categoryKey) || null : null;

      const found = currentChannels.find(c =>
        c && (
          c.name.toLowerCase() === chDef.name.toLowerCase() ||
          normalizeDiscordName(c.name) === targetNorm
        ) && (parentId ? c.parentId === parentId : true)
      ) || currentChannels.find(c =>
        c && (
          c.name.toLowerCase() === chDef.name.toLowerCase() ||
          normalizeDiscordName(c.name) === targetNorm
        )
      );

      if (!found) {
        const created = await ChannelService.createChannel(
          interaction.guild,
          {
            name: chDef.type === 'voice' ? chDef.name : sanitizeChannelName(chDef.name),
            type: chDef.type,
            parentId,
            topic: chDef.topic,
            rateLimitPerUser: 0,
            nsfw: false
          },
          operator
        );
        logs.push(`💬 Salon : #${chDef.name} créé`);
        currentChannels.set(created.id, created as any);
        channelKeyToId.set(key, created.id);
      } else {
        channelKeyToId.set(key, found.id);
      }
    }

    // 4. Synchronisation des départements déclarés
    if (config.departments && config.departments.length > 0) {
      for (const dept of config.departments) {
        let catId = dept.categoryId;
        const catName = dept.categoryName || `${dept.icon || '🔬'} PÔLE ${dept.name.toUpperCase()}`;

        let foundCat = null;
        if (catId) {
          foundCat = currentChannels.find(c => c && c.id === catId && c.type === ChannelType.GuildCategory);
        }
        if (!foundCat) {
          foundCat = existingCategories.find(c =>
            c && (
              c.name.toLowerCase() === catName.toLowerCase() ||
              normalizeDiscordName(c.name) === normalizeDiscordName(catName)
            )
          );
        }

        if (!foundCat) {
          foundCat = await interaction.guild.channels.create({
            name: catName,
            type: ChannelType.GuildCategory,
            reason: `CORTEX Sync : Pôle ${dept.name}`
          });
          logs.push(`🔬 Pôle Catégorie : "${catName}" créée`);
          currentChannels.set(foundCat.id, foundCat);
        }
        catId = foundCat.id;
        dept.categoryId = catId;

        // Rôle Chef
        if (!dept.leaderRoleId) {
          const leaderName = `Chef Pôle ${dept.shortName || dept.name}`;
          let foundLeader = existingRoles.find(r => r.name.toLowerCase() === leaderName.toLowerCase() || normalizeDiscordName(r.name) === normalizeDiscordName(leaderName));
          if (!foundLeader) {
            foundLeader = await interaction.guild.roles.create({
              name: leaderName,
              color: hexToDecimalColor(dept.color || '#E5092E'),
              hoist: true,
              mentionable: true,
              reason: `CORTEX Sync : Chef de pôle ${dept.name}`
            });
            logs.push(`🎖️ Rôle Chef : "${leaderName}" créé`);
          }
          dept.leaderRoleId = foundLeader.id;
        }

        // Rôle Adjoint
        if (!dept.deputyRoleId) {
          const deputyName = `Adjoint Pôle ${dept.shortName || dept.name}`;
          let foundDeputy = existingRoles.find(r => r.name.toLowerCase() === deputyName.toLowerCase() || normalizeDiscordName(r.name) === normalizeDiscordName(deputyName));
          if (!foundDeputy) {
            foundDeputy = await interaction.guild.roles.create({
              name: deputyName,
              color: hexToDecimalColor(dept.color || '#E5092E'),
              hoist: true,
              mentionable: true,
              reason: `CORTEX Sync : Adjoint pôle ${dept.name}`
            });
            logs.push(`🥈 Rôle Adjoint : "${deputyName}" créé`);
          }
          dept.deputyRoleId = foundDeputy.id;
        }

        // Rôle Membre
        if (!dept.memberRoleId) {
          const memberName = `Membre ${dept.shortName || dept.name}`;
          let foundMember = existingRoles.find(r => r.name.toLowerCase() === memberName.toLowerCase() || normalizeDiscordName(r.name) === normalizeDiscordName(memberName));
          if (!foundMember) {
            foundMember = await interaction.guild.roles.create({
              name: memberName,
              color: hexToDecimalColor(dept.color || '#E5092E'),
              hoist: false,
              mentionable: true,
              reason: `CORTEX Sync : Membre pôle ${dept.name}`
            });
            logs.push(`👥 Rôle Membre : "${memberName}" créé`);
          }
          dept.memberRoleId = foundMember.id;
        }

        // Salons de département avec déduplication stricte
        if (dept.channels && dept.channels.length > 0) {
          for (const ch of dept.channels) {
            const chNorm = normalizeDiscordName(ch.name);

            let foundCh = currentChannels.find(c =>
              c && c.parentId === catId && (
                c.name.toLowerCase() === ch.name.toLowerCase() ||
                normalizeDiscordName(c.name) === chNorm
              )
            ) || currentChannels.find(c =>
              c && (
                c.name.toLowerCase() === ch.name.toLowerCase() ||
                normalizeDiscordName(c.name) === chNorm
              )
            );

            if (!foundCh) {
              const chType = ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
              const channelOverwrites: any[] = [
                {
                  id: botMember.id,
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.ReadMessageHistory
                  ]
                }
              ];

              if (ch.name.startsWith('candidatures-')) {
                channelOverwrites.push(
                  { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                  ...(dept.memberRoleId ? [{ id: dept.memberRoleId, deny: [PermissionFlagsBits.ViewChannel] }] : []),
                  ...(dept.leaderRoleId ? [{ id: dept.leaderRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
                  ...(dept.deputyRoleId ? [{ id: dept.deputyRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
                );
              } else if (ch.readonly) {
                channelOverwrites.push(
                  { id: interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
                  ...(dept.memberRoleId ? [{ id: dept.memberRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions], deny: [PermissionFlagsBits.SendMessages] }] : []),
                  ...(dept.leaderRoleId ? [{ id: dept.leaderRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.MentionEveryone] }] : []),
                  ...(dept.deputyRoleId ? [{ id: dept.deputyRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.MentionEveryone] }] : [])
                );
              } else if (ch.type === 'voice') {
                channelOverwrites.push(
                  { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
                  ...(dept.memberRoleId ? [{ id: dept.memberRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }] : []),
                  ...(dept.leaderRoleId ? [{ id: dept.leaderRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.MoveMembers] }] : []),
                  ...(dept.deputyRoleId ? [{ id: dept.deputyRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.MoveMembers] }] : [])
                );
              } else {
                channelOverwrites.push(
                  { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                  ...(dept.memberRoleId ? [{ id: dept.memberRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] }] : []),
                  ...(dept.leaderRoleId ? [{ id: dept.leaderRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }] : []),
                  ...(dept.deputyRoleId ? [{ id: dept.deputyRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }] : [])
                );
              }

              const created = await interaction.guild.channels.create({
                name: ch.type === 'voice' ? ch.name : sanitizeChannelName(ch.name),
                type: chType,
                parent: catId || undefined,
                topic: ch.topic,
                permissionOverwrites: channelOverwrites,
                reason: `CORTEX Sync : Salon pôle ${dept.name}`
              });
              logs.push(`💬 Salon : #${created.name} créé`);
              currentChannels.set(created.id, created as any);
            }
          }
        }
      }
    }

    // 5. Synchronisation des permissions déclaratives
    if (config.channelPermissions) {
      for (const rule of config.channelPermissions) {
        const channelId = channelKeyToId.get(rule.channelKey);
        if (!channelId) continue;

        for (const overwrite of rule.overwrites) {
          let resolvedTargetId = roleKeyToId.get(overwrite.targetKey);
          if (!resolvedTargetId) {
            if (overwrite.targetKey === 'role:everyone' || overwrite.targetKey === '@everyone') {
              resolvedTargetId = interaction.guild.id;
            } else if (overwrite.targetKey.startsWith('role:')) {
              const rName = overwrite.targetKey.replace('role:', '');
              const foundRole = existingRoles.find(r => r.name.toLowerCase() === rName.toLowerCase() || normalizeDiscordName(r.name) === normalizeDiscordName(rName));
              if (foundRole) resolvedTargetId = foundRole.id;
            } else {
              resolvedTargetId = overwrite.targetKey;
            }
          }
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

    const embed = new EmbedBuilder()
      .setTitle('✅ Synchronisation CORTEX Réussie')
      .setColor(0x10B981)
      .setDescription(
        logs.length > 0
          ? `Le serveur Discord a été mis en conformité avec la configuration déclarative :\n\n${logs.join('\n')}`
          : 'Le serveur Discord est déjà 100% conforme à votre fichier de configuration JSON.'
      )
      .setFooter({ text: 'CORTEX Scientific Club • Pilotage Déclaratif' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({ content: `❌ Erreur pendant la synchronisation : ${err.message}` });
  }
}
