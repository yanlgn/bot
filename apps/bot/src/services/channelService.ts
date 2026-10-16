import {
  Guild,
  ChannelType,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
  PermissionFlagsBits,
  GuildChannel
} from 'discord.js';
import {
  DiscordChannelData,
  CreateChannelInput,
  UpdateChannelInput,
  sanitizeChannelName
} from '@sciclub/shared';
import { AuditLogService } from './auditLogService.js';

export class ChannelService {
  /**
   * Retourne tous les salons organisés
   */
  static async getChannels(guild: Guild): Promise<DiscordChannelData[]> {
    const channels = await guild.channels.fetch();
    const result: DiscordChannelData[] = [];

    for (const [, ch] of channels) {
      if (!ch) continue;

      let type: 'text' | 'voice' | 'category' | 'forum' | 'announcement' = 'text';
      if (ch.type === ChannelType.GuildVoice) type = 'voice';
      else if (ch.type === ChannelType.GuildCategory) type = 'category';
      else if (ch.type === ChannelType.GuildAnnouncement) type = 'announcement';
      else if (ch.type === ChannelType.GuildForum) type = 'forum';

      const overwrites = 'permissionOverwrites' in ch ? Array.from(ch.permissionOverwrites.cache.values()).map(o => ({
        id: o.id,
        type: (o.type === 0 ? 'role' : 'member') as 'role' | 'member',
        allow: o.allow.toArray(),
        deny: o.deny.toArray()
      })) : [];

      result.push({
        id: ch.id,
        name: ch.name,
        type,
        parentId: ch.parentId,
        parentName: ch.parent ? ch.parent.name : null,
        position: 'rawPosition' in ch ? ch.rawPosition : 0,
        topic: 'topic' in ch ? (ch.topic ?? null) : null,
        nsfw: 'nsfw' in ch ? (ch.nsfw ?? false) : false,
        rateLimitPerUser: 'rateLimitPerUser' in ch ? (ch.rateLimitPerUser ?? 0) : 0,
        permissionOverwrites: overwrites
      });
    }

    return result.sort((a, b) => a.position - b.position);
  }

  /**
   * Crée un nouveau salon Discord
   */
  static async createChannel(
    guild: Guild,
    input: CreateChannelInput,
    operator: { id: string; username: string }
  ): Promise<GuildChannel> {
    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      throw new Error('Le bot ne possède pas la permission "Gérer les salons" (ManageChannels).');
    }

    let channelType = ChannelType.GuildText;
    if (input.type === 'voice') channelType = ChannelType.GuildVoice;
    else if (input.type === 'category') channelType = ChannelType.GuildCategory;
    else if (input.type === 'announcement') channelType = ChannelType.GuildAnnouncement;
    else if (input.type === 'forum') channelType = ChannelType.GuildForum;

    const sanitized = input.type === 'category' ? input.name : sanitizeChannelName(input.name);

    const created = await guild.channels.create({
      name: sanitized,
      type: channelType,
      parent: input.parentId || undefined,
      topic: input.topic,
      rateLimitPerUser: input.rateLimitPerUser,
      nsfw: input.nsfw,
      reason: `Créé par ${operator.username} via SciClub Manager`
    });

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'CHANNEL_CREATED',
      targetType: 'channel',
      targetId: created.id,
      details: `Salon "${created.name}" (${input.type}) créé`
    });

    return created;
  }

  /**
   * Modifie un salon existant
   */
  static async updateChannel(
    guild: Guild,
    channelId: string,
    input: UpdateChannelInput,
    operator: { id: string; username: string }
  ): Promise<GuildChannel> {
    const channel = await guild.channels.fetch(channelId);
    if (!channel) throw new Error('Salon introuvable.');

    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      throw new Error('Le bot ne possède pas la permission "Gérer les salons".');
    }

    // Gestion du verrouillage (Lock/Unlock) pour un salon texte
    if (typeof input.isLocked === 'boolean' && channel.isTextBased() && 'permissionOverwrites' in channel) {
      await (channel as TextChannel).permissionOverwrites.edit(guild.id, {
        SendMessages: input.isLocked ? false : null
      }, { reason: `${input.isLocked ? 'Verrouillage' : 'Déverrouillage'} par ${operator.username}` });
    }

    const editData: Record<string, unknown> = {};
    if (input.name) {
      editData.name = channel.type === ChannelType.GuildCategory ? input.name : sanitizeChannelName(input.name);
    }
    if (input.parentId !== undefined) {
      editData.parent = input.parentId;
    }
    if (input.topic !== undefined && 'setTopic' in channel) {
      editData.topic = input.topic;
    }
    if (input.rateLimitPerUser !== undefined && 'setRateLimitPerUser' in channel) {
      editData.rateLimitPerUser = input.rateLimitPerUser;
    }

    const updated = await (channel as TextChannel | VoiceChannel | CategoryChannel).edit(editData);

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'CHANNEL_UPDATED',
      targetType: 'channel',
      targetId: channelId,
      details: `Salon "${updated.name}" mis à jour`
    });

    return updated as GuildChannel;
  }

  /**
   * Supprime un salon Discord
   */
  static async deleteChannel(
    guild: Guild,
    channelId: string,
    operator: { id: string; username: string }
  ): Promise<void> {
    const channel = await guild.channels.fetch(channelId);
    if (!channel) throw new Error('Salon introuvable.');

    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      throw new Error('Le bot ne possède pas la permission "Gérer les salons".');
    }

    const channelName = channel.name;
    await channel.delete(`Supprimé par ${operator.username} depuis SciClub Manager`);

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'CHANNEL_DELETED',
      targetType: 'channel',
      targetId: channelId,
      details: `Salon "${channelName}" (${channelId}) supprimé`
    });
  }
}
