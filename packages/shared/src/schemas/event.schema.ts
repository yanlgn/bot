import { z } from 'zod';

export const EventSessionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Le nom de la session est requis').max(100),
  description: z.string().max(500).optional().nullable(),
  dayOfWeek: z.string().max(50).optional().nullable(),
  startTime: z.string().max(20).optional().nullable(),
  endTime: z.string().max(20).optional().nullable(),
  scheduledStartTime: z.string().optional().nullable(),
  scheduledEndTime: z.string().optional().nullable(),
  maxParticipants: z.number().int().min(0).optional().nullable()
});

export const CreateEventSchema = z.object({
  title: z.string().min(3, 'Le titre doit faire au moins 3 caractères').max(150),
  description: z.string().min(10, 'La description doit faire au moins 10 caractères').max(3000),
  type: z.enum(['conference', 'workshop', 'competition', 'field_trip', 'hackathon', 'training']),
  scheduledStartTime: z.string({ message: 'Date et heure de début requises' }),
  endTime: z.string().optional().nullable(),
  location: z.string().min(1).max(200),
  speaker: z.string().max(100).optional().nullable(),
  maxParticipants: z.number().int().min(0).optional().nullable(),
  targetAudience: z.string().max(100).optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  recurrencePattern: z.string().max(100).optional().nullable(),
  recurrenceDay: z.string().max(50).optional().nullable(),
  recurrenceTime: z.string().max(20).optional().nullable(),
  allowCancellation: z.boolean().optional().default(true),
  channelId: z.string().regex(/^\d{17,20}$/).optional().nullable(),
  createParticipantRole: z.boolean().optional().default(true),
  sessions: z.array(EventSessionSchema).optional()
});

export const UpdateEventSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  description: z.string().min(10).max(3000).optional(),
  type: z.enum(['conference', 'workshop', 'competition', 'field_trip', 'hackathon', 'training']).optional(),
  scheduledStartTime: z.string().optional(),
  endTime: z.string().optional().nullable(),
  location: z.string().min(1).max(200).optional(),
  speaker: z.string().max(100).optional().nullable(),
  maxParticipants: z.number().int().min(0).optional().nullable(),
  targetAudience: z.string().max(100).optional().nullable(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.string().max(100).optional().nullable(),
  recurrenceDay: z.string().max(50).optional().nullable(),
  recurrenceTime: z.string().max(20).optional().nullable(),
  allowCancellation: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional(),
  channelId: z.string().regex(/^\d{17,20}$/).optional().nullable(),
  sessions: z.array(EventSessionSchema).optional()
});

export type CreateEventInput = z.input<typeof CreateEventSchema>;
export type UpdateEventInput = z.input<typeof UpdateEventSchema>;
