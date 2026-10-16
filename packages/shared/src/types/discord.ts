export type DiscordPermissionState = 'ALLOW' | 'DENY' | 'NEUTRAL';

export type DiscordChannelType = 'text' | 'voice' | 'category' | 'forum' | 'announcement';

export interface DiscordRoleData {
  id: string;
  name: string;
  color: number;
  hexColor: string;
  position: number;
  hoist: boolean;
  managed: boolean;
  mentionable: boolean;
  permissions: string[];
  memberCount?: number;
  isBotHighest?: boolean;
  isEditable?: boolean;
}

export interface DiscordChannelData {
  id: string;
  name: string;
  type: DiscordChannelType;
  parentId: string | null;
  parentName?: string | null;
  position: number;
  topic?: string | null;
  nsfw: boolean;
  rateLimitPerUser?: number;
  permissionOverwrites: DiscordOverwriteRecord[];
}

export interface DiscordOverwriteRecord {
  id: string;
  type: 'role' | 'member';
  allow: string[];
  deny: string[];
}

export interface DiscordMemberData {
  id: string;
  username: string;
  discriminator: string;
  globalName: string | null;
  nickname: string | null;
  avatarUrl: string;
  roles: string[];
  joinedAt: string | null;
  isBot: boolean;
  points?: number;
  warningsCount?: number;
}

export interface DiscordGuildData {
  id: string;
  name: string;
  icon: string | null;
  iconUrl: string | null;
  ownerId: string;
  approximateMemberCount?: number;
  botHasPermissions: boolean;
  userPermissions: string[];
  isAdmin: boolean;
}
