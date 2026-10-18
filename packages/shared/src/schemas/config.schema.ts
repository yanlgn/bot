import { z } from 'zod';
import { DepartmentConfigItemSchema } from './department.schema.js';

export const PermissionStateSchema = z.enum(['ALLOW', 'DENY', 'NEUTRAL']);

export const ClubInfoSchema = z.object({
  name: z.string().min(1, 'Le nom du club est obligatoire').max(100),
  description: z.string().max(1000).default(''),
  logoUrl: z.string().url('URL du logo invalide').or(z.literal('')).optional()
});

export const RoleConfigItemSchema = z.object({
  name: z.string().min(1, 'Le nom du rôle est requis').max(100),
  color: z.string().regex(/^#([0-9A-Fa-f]{6})$/, 'Format de couleur invalide (ex: #E11D48)'),
  permissions: z.array(z.string()).default([]),
  protected: z.boolean().default(false)
});

export const CategoryConfigItemSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_-]+$/, 'La clé de catégorie doit être en minuscules alphanumériques'),
  name: z.string().min(1).max(100)
});

export const ChannelConfigItemSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-_]+$/, 'Le nom de canal Discord doit être en minuscules avec tirets'),
  type: z.enum(['text', 'voice', 'category', 'forum']).default('text'),
  categoryKey: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  topic: z.string().max(1024).optional(),
  readonlyForMembers: z.boolean().default(false)
});

export const OverwriteConfigItemSchema = z.object({
  targetKey: z.string().min(1, 'La cible de permission est requise (ex: role:member ou user:123456)'),
  permissions: z.record(z.string(), PermissionStateSchema)
});

export const ChannelPermissionConfigItemSchema = z.object({
  channelKey: z.string().min(1),
  overwrites: z.array(OverwriteConfigItemSchema)
});

export const ModerationConfigSchema = z.object({
  logChannelKey: z.string().optional(),
  maxWarnings: z.number().int().min(1).max(10).default(3),
  autoMuteDurationMinutes: z.number().int().min(1).max(10080).default(60),
  badWordsFilter: z.boolean().default(true)
});

export const PointsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  messagePoints: z.number().int().min(0).default(1),
  eventParticipationPoints: z.number().int().min(0).default(10),
  projectCreationPoints: z.number().int().min(0).default(20),
  resourceSharingPoints: z.number().int().min(0).default(5)
});

export const GuildConfigFileSchema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/, 'Guild ID Discord invalide'),
  locale: z.string().default('fr'),
  timezone: z.string().default('Europe/Paris'),
  club: ClubInfoSchema,
  departments: z.array(DepartmentConfigItemSchema).default([]),
  roles: z.record(z.string(), RoleConfigItemSchema),
  categories: z.array(CategoryConfigItemSchema).default([]),
  channels: z.record(z.string(), ChannelConfigItemSchema),
  channelPermissions: z.array(ChannelPermissionConfigItemSchema).default([]),
  moderation: ModerationConfigSchema,
  points: PointsConfigSchema
});

export type GuildConfigFileInput = z.infer<typeof GuildConfigFileSchema>;
