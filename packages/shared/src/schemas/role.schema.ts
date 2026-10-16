import { z } from 'zod';

export const CreateRoleSchema = z.object({
  name: z.string().min(1, 'Le nom du rôle est requis').max(100),
  color: z.string().regex(/^#([0-9A-Fa-f]{6})$/, 'La couleur doit être au format hexadécimal #RRGGBB').default('#64748B'),
  hoist: z.boolean().default(false),
  mentionable: z.boolean().default(false),
  permissions: z.array(z.string()).default([])
});

export const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#([0-9A-Fa-f]{6})$/).optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  permissions: z.array(z.string()).optional()
});

export const AssignRoleSchema = z.object({
  roleId: z.string().regex(/^\d{17,20}$/, 'Role ID invalide')
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type AssignRoleInput = z.infer<typeof AssignRoleSchema>;
