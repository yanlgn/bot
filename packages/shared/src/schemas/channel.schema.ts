import { z } from 'zod';

export const CreateChannelSchema = z.object({
  name: z.string().min(1, 'Le nom du canal est requis').max(100),
  type: z.enum(['text', 'voice', 'category', 'forum', 'announcement']).default('text'),
  parentId: z.string().regex(/^\d{17,20}$/).nullable().optional(),
  topic: z.string().max(1024).optional(),
  rateLimitPerUser: z.number().int().min(0).max(21600).default(0),
  nsfw: z.boolean().default(false)
});

export const UpdateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().regex(/^\d{17,20}$/).nullable().optional(),
  topic: z.string().max(1024).optional(),
  rateLimitPerUser: z.number().int().min(0).max(21600).optional(),
  isLocked: z.boolean().optional()
});

export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;
export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>;
