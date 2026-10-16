import { z } from 'zod';

export const CreateEventSchema = z.object({
  title: z.string().min(3, 'Le titre doit faire au moins 3 caractères').max(150),
  description: z.string().min(10, 'La description doit faire au moins 10 caractères').max(3000),
  type: z.enum(['conference', 'workshop', 'competition', 'field_trip', 'hackathon', 'training']),
  scheduledStartTime: z.string().datetime({ message: 'Date et heure de début ISO-8601 invalides' }),
  location: z.string().min(1).max(200),
  speaker: z.string().max(100).optional().nullable(),
  maxParticipants: z.number().int().min(1).optional().nullable(),
  targetAudience: z.string().max(100).optional().nullable(),
  channelId: z.string().regex(/^\d{17,20}$/).optional().nullable(),
  createParticipantRole: z.boolean().default(true)
});

export const UpdateEventSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  description: z.string().min(10).max(3000).optional(),
  type: z.enum(['conference', 'workshop', 'competition', 'field_trip', 'hackathon', 'training']).optional(),
  scheduledStartTime: z.string().datetime().optional(),
  location: z.string().min(1).max(200).optional(),
  speaker: z.string().max(100).optional().nullable(),
  maxParticipants: z.number().int().min(1).optional().nullable(),
  targetAudience: z.string().max(100).optional().nullable(),
  status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional(),
  channelId: z.string().regex(/^\d{17,20}$/).optional().nullable()
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
