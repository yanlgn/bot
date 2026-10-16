import { z } from 'zod';

export const ScientificCategories = [
  'ia',
  'robotique',
  'programmation',
  'physique',
  'chimie',
  'biologie',
  'mathematiques',
  'astronomie'
] as const;

export const CreateResourceSchema = z.object({
  title: z.string().min(3, 'Le titre doit faire au moins 3 caractères').max(150),
  description: z.string().min(5, 'La description doit faire au moins 5 caractères').max(2000),
  url: z.string().url('Lien de la ressource invalide'),
  category: z.enum(ScientificCategories),
  tags: z.array(z.string().min(1).max(30)).default([]),
  publishToDiscord: z.boolean().default(true)
});

export type CreateResourceInput = z.infer<typeof CreateResourceSchema>;
