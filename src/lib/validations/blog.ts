import { z } from 'zod';
import { distributionFields, refineDistribution } from './distribution';
import { paginationSchema, slugSchema } from './common';

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida')
  .optional()
  .or(z.literal(''))
  .nullable();

const optionalDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Fecha y hora no válida')
  .optional()
  .or(z.literal(''))
  .nullable();

export const blogStatusEnum = z.enum(['draft', 'scheduled', 'published', 'archived']);

export const blogInputSchema = z
  .object({
    title: z.string().trim().min(2, 'Mínimo 2 caracteres').max(200),
    slug: slugSchema,
    excerpt: z.string().trim().max(400).optional().or(z.literal('')),
    contentHtml: z.string().max(200_000).optional().or(z.literal('')),
    contentJson: z.unknown().nullable().optional(),
    featuredMediaId: z.string().uuid().nullable().optional(),
    ogMediaId: z.string().uuid().nullable().optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    tagNames: z.array(z.string().trim().min(1).max(48)).max(20),
    publishDate: optionalDate,
    scheduleAt: optionalDateTime,
    status: blogStatusEnum,
    metaTitle: z.string().trim().max(180).optional().or(z.literal('')),
    metaDescription: z.string().trim().max(320).optional().or(z.literal('')),
    ...distributionFields,
  })
  .superRefine((val, ctx) => {
    refineDistribution(val, ctx);
    if (val.status === 'scheduled') {
      if (!val.scheduleAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scheduleAt'],
          message: 'Indica la fecha y hora de publicación',
        });
      } else if (new Date(val.scheduleAt).getTime() <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scheduleAt'],
          message: 'La fecha programada debe ser futura',
        });
      }
    }
    if (
      (val.status === 'published' || val.status === 'scheduled') &&
      !(val.contentHtml && val.contentHtml.trim().length > 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentHtml'],
        message: 'El artículo necesita contenido',
      });
    }
  });

export type BlogInput = z.infer<typeof blogInputSchema>;

export const blogListSchema = paginationSchema.extend({
  status: blogStatusEnum.optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  portalId: z.coerce.number().int().positive().optional(),
});
