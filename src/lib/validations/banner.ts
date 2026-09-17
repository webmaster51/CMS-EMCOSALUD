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

/**
 * Banner hero / slider (plan §19). Sale **fijo en la página de inicio** del portal; el visitante
 * solo navega entre imágenes, no lo cierra. Comparte con los popups la distribución multiportal y
 * la programación por fecha, pero sin frecuencia, dispositivo, páginas ni cierre; añade
 * `sortOrder` (posición en el carrusel).
 */
export const bannerInputSchema = z
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
    sortOrder: z.coerce.number().int().min(0).max(9999),
    startsAt: optionalDateTime,
    endsAt: optionalDateTime,
    status: z.enum(['draft', 'scheduled', 'active', 'inactive', 'finished']),
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
    if (val.status === 'scheduled' && !val.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startsAt'],
        message: 'Un banner programado necesita fecha inicial',
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

export type BannerInput = z.infer<typeof bannerInputSchema>;

export const bannerListSchema = paginationSchema.extend({
  status: z.enum(['draft', 'scheduled', 'active', 'inactive', 'finished']).optional(),
  portalId: z.coerce.number().int().positive().optional(),
});

export const bannerReorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});
