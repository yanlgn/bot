import { z } from 'zod';

export const DepartmentChannelConfigSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['text', 'voice', 'forum']).default('text'),
  topic: z.string().max(1024).optional(),
  readonly: z.boolean().default(false)
});

export const DepartmentConfigItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/, 'L\'identifiant du département doit être en minuscules alphanumériques avec tirets'),
  name: z.string().min(1, 'Le nom du pôle est requis').max(100),
  shortName: z.string().max(20).optional(),
  icon: z.string().default('🔬'),
  color: z.string().regex(/^#([0-9A-Fa-f]{6})$/, 'Format hexadécimal requis (ex: #E5092E)').default('#E5092E'),
  description: z.string().max(1000).default(''),
  leaderRoleId: z.string().optional().nullable(),
  deputyRoleId: z.string().optional().nullable(),
  memberRoleId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  categoryName: z.string().max(100).optional(),
  channels: z.array(DepartmentChannelConfigSchema).default([])
});

export const CreateDepartmentSchema = z.object({
  name: z.string().min(2, 'Le nom du pôle doit comporter au moins 2 caractères').max(100),
  shortName: z.string().max(20).optional(),
  icon: z.string().min(1).max(10).default('🔬'),
  color: z.string().regex(/^#([0-9A-Fa-f]{6})$/, 'Couleur hexadécimale invalide').default('#E5092E'),
  description: z.string().max(1000).default(''),
  leaderUserId: z.string().optional().nullable(),
  deputyUserId: z.string().optional().nullable(),
  createChannels: z.boolean().default(true),
  createRoles: z.boolean().default(true),
  createCategory: z.boolean().default(true)
});

export const UpdateDepartmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  shortName: z.string().max(20).optional(),
  icon: z.string().min(1).max(10).optional(),
  color: z.string().regex(/^#([0-9A-Fa-f]{6})$/).optional(),
  description: z.string().max(1000).optional(),
  leaderRoleId: z.string().optional().nullable(),
  deputyRoleId: z.string().optional().nullable(),
  memberRoleId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable()
});

export const ReviewDepartmentMemberSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional()
});

export type DepartmentConfigItemInput = z.infer<typeof DepartmentConfigItemSchema>;
export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;
export type ReviewDepartmentMemberInput = z.infer<typeof ReviewDepartmentMemberSchema>;
