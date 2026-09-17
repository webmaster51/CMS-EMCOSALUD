import { z } from 'zod';
import { distributionFields, refineDistribution } from './distribution';
import { paginationSchema } from './common';

export const boletinListSchema = paginationSchema.extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  portalId: z.coerce.number().int().positive().optional(),
});

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida')
  .optional()
  .or(z.literal(''))
  .nullable();

export const boletinInputSchema = z
  .object({
    title: z.string().trim().min(2, 'Mínimo 2 caracteres').max(200),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    pdfMediaId: z.string().uuid().nullable().optional(),
    coverMediaId: z.string().uuid().nullable().optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    publishedDate: optionalDate,
    status: z.enum(['draft', 'published', 'archived']),
    ...distributionFields,
  })
  .superRefine((val, ctx) => {
    refineDistribution(val, ctx);
    if (val.status === 'published' && !val.pdfMediaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pdfMediaId'],
        message: 'Un boletín publicado necesita el PDF',
      });
    }
  });

export type BoletinInput = z.infer<typeof boletinInputSchema>;
