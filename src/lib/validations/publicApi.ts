import { z } from 'zod';

export const publicListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().trim().max(96).optional(),
  tag: z.string().trim().max(96).optional(),
  search: z.string().trim().max(120).optional(),
  since: z.string().trim().max(40).optional(),
});
export type PublicListQuery = z.infer<typeof publicListSchema>;

export const popupsQuerySchema = z.object({
  path: z.string().trim().max(512).default('/'),
  device: z.enum(['all', 'desktop', 'tablet', 'mobile']).default('all'),
});

export const financialStatementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  year: z.coerce.number().int().min(1990).max(2100).optional(),
});

export const certificateQuerySchema = z.object({
  company: z.string().trim().min(3).max(32),
  year: z.coerce.number().int().min(1990).max(2100),
  document: z.string().trim().min(3).max(32),
});
