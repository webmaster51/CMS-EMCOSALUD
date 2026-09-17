import { z } from 'zod';
import { slugSchema } from './common';

export const portalInputSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  shortName: z.string().trim().min(1, 'Requerido').max(60),
  slug: slugSchema,
  url: z.string().trim().url('URL no válida').max(300),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']),
  logoMediaId: z.string().uuid().nullable().optional(),
  deployHookUrl: z
    .string()
    .trim()
    .url('URL no válida')
    .max(500)
    .optional()
    .or(z.literal('')),
});

export type PortalInput = z.infer<typeof portalInputSchema>;

export const apiKeyInputSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
});
export type ApiKeyInput = z.infer<typeof apiKeyInputSchema>;
