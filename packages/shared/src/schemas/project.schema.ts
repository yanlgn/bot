import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(2, 'Le nom du projet doit contenir au moins 2 caractères').max(100),
  description: z.string().min(5, 'Description trop courte').max(2000),
  leaderId: z.string().regex(/^\d{17,20}$/, 'ID de responsable Discord invalide'),
  memberIds: z.array(z.string().regex(/^\d{17,20}$/)).default([]),
  createChannel: z.boolean().default(true)
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().min(5).max(2000).optional(),
  leaderId: z.string().regex(/^\d{17,20}$/).optional(),
  status: z.enum(['idea', 'in_progress', 'paused', 'completed', 'archived']).optional(),
  memberIds: z.array(z.string().regex(/^\d{17,20}$/)).optional(),
  archiveChannel: z.boolean().optional()
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
