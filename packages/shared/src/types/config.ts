import { DiscordPermissionState } from './discord.js';

export interface ClubInfoConfig {
  name: string;
  description: string;
  logoUrl?: string;
}

export interface RoleConfigItem {
  name: string;
  color: string;
  permissions: string[];
  protected?: boolean;
}

export interface CategoryConfigItem {
  key: string;
  name: string;
}

export interface ChannelConfigItem {
  name: string;
  type: 'text' | 'voice' | 'category' | 'forum';
  categoryKey?: string | null;
  categoryId?: string | null;
  topic?: string;
  readonlyForMembers?: boolean;
}

export interface OverwriteConfigItem {
  targetKey: string; // e.g. "role:member" or "role:admin" or "user:12345"
  permissions: Record<string, DiscordPermissionState>;
}

export interface ChannelPermissionConfigItem {
  channelKey: string;
  overwrites: OverwriteConfigItem[];
}

export interface ModerationConfig {
  logChannelKey?: string;
  maxWarnings: number;
  autoMuteDurationMinutes: number;
  badWordsFilter?: boolean;
}

export interface PointsConfig {
  enabled: boolean;
  messagePoints: number;
  eventParticipationPoints: number;
  projectCreationPoints: number;
  resourceSharingPoints: number;
}

export interface GuildConfigFile {
  guildId: string;
  locale: string;
  timezone: string;
  club: ClubInfoConfig;
  roles: Record<string, RoleConfigItem>;
  categories: CategoryConfigItem[];
  channels: Record<string, ChannelConfigItem>;
  channelPermissions: ChannelPermissionConfigItem[];
  moderation: ModerationConfig;
  points: PointsConfig;
}
