import { z } from 'zod';
import { distributionFields, refineDistribution } from './distribution';
import { paginationSchema } from './common';

const optionalDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Fecha y hora no válida')
  .optional()
  .or(z.literal(''))
  .nullable();

const pathSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .transform((p) => (p.startsWith('/') ? p : `/${p}`))
  .refine((p) => !/\s/.test(p), 'La ruta no puede tener espacios');

export const popupInputSchema = z
  .object({
    internalName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
    title: z.string().trim().max(160).optional().or(z.literal('')),
    subtitle: z.string().trim().max(200).optional().or(z.literal('')),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    imageMediaId: z.string().uuid().nullable().optional(),
    mobileImageMediaId: z.string().uuid().nullable().optional(),
    buttonText: z.string().trim().max(60).optional().or(z.literal('')),
    url: z.string().trim().max(500).optional().or(z.literal('')),
    linkType: z.enum(['internal', 'external', 'none']),
    pageMode: z.enum(['all_pages', 'specific_pages']),
    paths: z.array(pathSchema).max(100),
    startsAt: optionalDateTime,
    endsAt: optionalDateTime,
    status: z.enum(['draft', 'scheduled', 'active', 'inactive', 'finished']),
    priority: z.coerce.number().int().min(0).max(1000),
    frequency: z.enum(['always', 'once_session', 'once_user', 'every_x_days']),
    frequencyDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
    device: z.enum(['all', 'desktop', 'tablet', 'mobile']),
    ...distributionFields,
  })
  .superRefine((val, ctx) => {
    refineDistribution(val, ctx);
    if (val.linkType !== 'none' && !val.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'Indica la URL del enlace',
      });
    }
    if (val.frequency === 'every_x_days' && !val.frequencyDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['frequencyDays'],
        message: 'Indica cada cuántos días',
      });
    }
    if (val.pageMode === 'specific_pages' && val.paths.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paths'],
        message: 'Añade al menos una página',
      });
    }
    if (val.status === 'scheduled' && !val.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startsAt'],
        message: 'Un popup programado necesita fecha inicial',
      });
    }
    if (val.startsAt && val.endsAt && new Date(val.endsAt) <= new Date(val.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'La fecha final debe ser posterior a la inicial',
      });
    }
  });

export type PopupInput = z.infer<typeof popupInputSchema>;

export const popupListSchema = paginationSchema.extend({
  status: z.enum(['draft', 'scheduled', 'active', 'inactive', 'finished']).optional(),
  portalId: z.coerce.number().int().positive().optional(),
});
