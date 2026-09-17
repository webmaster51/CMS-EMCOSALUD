import { z } from 'zod';
import { paginationSchema } from './common';

export const mediaListSchema = paginationSchema.extend({
  kind: z.enum(['image', 'document', 'video', 'archive', 'other']).optional(),
});

export const mediaRenameSchema = z.object({
  internalName: z.string().trim().max(160).nullable().optional(),
});
