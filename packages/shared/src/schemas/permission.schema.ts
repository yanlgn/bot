import { z } from 'zod';
import { PermissionStateSchema } from './config.schema.js';

export const UpdateChannelPermissionSchema = z.object({
  targetId: z.string().regex(/^\d{17,20}$/, 'ID de rôle ou de membre invalide'),
  targetType: z.enum(['role', 'member']),
  permissions: z.record(z.string(), PermissionStateSchema)
});

export type UpdateChannelPermissionInput = z.infer<typeof UpdateChannelPermissionSchema>;
