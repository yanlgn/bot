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

export interface DepartmentChannelConfig {
  name: string;
  type?: 'text' | 'voice' | 'forum';
  topic?: string;
  readonly?: boolean;
}

export interface DepartmentConfigItem {
  id: string;
  name: string;
  shortName?: string;
  icon?: string;
  color?: string;
  description?: string;
  leaderRoleId?: string | null;
  deputyRoleId?: string | null;
  memberRoleId?: string | null;
  categoryId?: string | null;
  categoryName?: string;
  channels?: DepartmentChannelConfig[];
}

export interface GuildConfigFile {
  guildId: string;
  locale: string;
  timezone: string;
  club: ClubInfoConfig;
  departments?: DepartmentConfigItem[];
  roles: Record<string, RoleConfigItem>;
  categories: CategoryConfigItem[];
  channels: Record<string, ChannelConfigItem>;
  channelPermissions: ChannelPermissionConfigItem[];
  moderation: ModerationConfig;
  points: PointsConfig;
}
