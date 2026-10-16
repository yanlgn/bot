import {
  Guild,
  PermissionFlagsBits,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
  ForumChannel
} from 'discord.js';
import { UpdateChannelPermissionInput } from '@sciclub/shared';
import { AuditLogService } from './auditLogService.js';

type SupportedChannel = TextChannel | VoiceChannel | CategoryChannel | ForumChannel;

export class PermissionService {
  /**
   * Met à jour ou configure les overwrites de permissions d'un salon
   */
  static async updateChannelPermissions(
    guild: Guild,
    channelId: string,
    input: UpdateChannelPermissionInput,
    operator: { id: string; username: string }
  ): Promise<void> {
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !('permissionOverwrites' in channel)) {
      throw new Error('Salon introuvable ou ne supporte pas la gestion des permissions.');
    }

    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('Le bot requiert les permissions "Gérer les salons" et "Gérer les rôles".');
    }

    // Convertit l'objet { PermFlag: 'ALLOW' | 'DENY' | 'NEUTRAL' } pour Discord.js
    const discordOverwrites: Record<string, boolean | null> = {};

    for (const [permFlag, state] of Object.entries(input.permissions)) {
      if (!(permFlag in PermissionFlagsBits)) {
        continue;
      }

      // Règle de sécurité : le bot ne peut pas donner une permission qu'il ne possède pas lui-même
      const requiredBit = PermissionFlagsBits[permFlag as keyof typeof PermissionFlagsBits];
      if (state === 'ALLOW' && !botMember.permissions.has(requiredBit)) {
        throw new Error(`Le bot ne possède pas la permission "${permFlag}" et ne peut donc pas l'accorder.`);
      }

      if (state === 'ALLOW') {
        discordOverwrites[permFlag] = true;
      } else if (state === 'DENY') {
        discordOverwrites[permFlag] = false;
      } else {
        discordOverwrites[permFlag] = null; // Neutre / Hérité
      }
    }

    const target = input.targetType === 'role'
      ? await guild.roles.fetch(input.targetId)
      : await guild.members.fetch(input.targetId);

    if (!target) {
      throw new Error(`Cible ${input.targetType} introuvable (ID: ${input.targetId}).`);
    }

    const typedChannel = channel as SupportedChannel;
    await typedChannel.permissionOverwrites.edit(
      input.targetId,
      discordOverwrites,
      {
        type: input.targetType === 'role' ? 0 : 1,
        reason: `Permissions modifiées par ${operator.username} depuis SciClub Manager`
      }
    );

    const targetLabel = 'name' in target ? target.name : target.user.tag;

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'PERMISSION_OVERWRITE_UPDATED',
      targetType: 'permission',
      targetId: `${channelId}:${input.targetId}`,
      details: `Permissions modifiées pour "${targetLabel}" sur le salon #${typedChannel.name}`
    });
  }

  /**
   * Supprime complètement un overwrite de permission sur un salon
   */
  static async deleteChannelPermission(
    guild: Guild,
    channelId: string,
    targetId: string,
    operator: { id: string; username: string }
  ): Promise<void> {
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !('permissionOverwrites' in channel)) {
      throw new Error('Salon introuvable.');
    }

    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      throw new Error('Le bot requiert la permission "Gérer les salons".');
    }

    const typedChannel = channel as SupportedChannel;
    await typedChannel.permissionOverwrites.delete(
      targetId,
      `Overwrite réinitialisé par ${operator.username}`
    );

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'PERMISSION_OVERWRITE_DELETED',
      targetType: 'permission',
      targetId: `${channelId}:${targetId}`,
      details: `Permissions réinitialisées pour la cible ${targetId} sur le salon #${typedChannel.name}`
    });
  }
}
