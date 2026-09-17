import { z } from 'zod';
import { distributionFields, refineDistribution } from './distribution';
import { paginationSchema } from './common';

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida')
  .optional()
  .or(z.literal(''))
  .nullable();

export const boardPublicationInputSchema = z
  .object({
    title: z.string().trim().min(2, 'Mínimo 2 caracteres').max(200),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    imageMediaId: z.string().uuid().nullable().optional(),
    publishedDate: optionalDate,
    status: z.enum(['draft', 'published', 'archived']),
    ...distributionFields,
  })
  .superRefine((val, ctx) => {
    refineDistribution(val, ctx);
    if (val.status === 'published' && !val.imageMediaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['imageMediaId'],
        message: 'Una publicación publicada necesita imagen',
      });
    }
  });

export type BoardPublicationInput = z.infer<typeof boardPublicationInputSchema>;

export const boardPublicationListSchema = paginationSchema.extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  portalId: z.coerce.number().int().positive().optional(),
});
