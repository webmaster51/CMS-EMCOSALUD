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

const fileEntrySchema = z.object({
  label: z.string().trim().min(1, 'Requerido').max(120),
  mediaId: z.string().uuid('Selecciona el documento'),
});

/**
 * Estados financieros (plan §20): un juego de documentos por empresa y año.
 * La unicidad (empresa, año) se refuerza también en la base de datos.
 */
export const financialStatementInputSchema = z
  .object({
    companyId: z.coerce.number().int().positive(),
    fiscalYear: z.coerce.number().int().min(1990).max(2100),
    title: z.string().trim().max(200).optional().or(z.literal('')),
    summary: z.string().trim().max(2000).optional().or(z.literal('')),
    publishedDate: optionalDate,
    status: z.enum(['draft', 'published', 'archived']),
    files: z.array(fileEntrySchema).max(20),
    ...distributionFields,
  })
  .superRefine((val, ctx) => {
    refineDistribution(val, ctx);
    if (val.status === 'published' && val.files.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['files'],
        message: 'Añade al menos un documento para publicar',
      });
    }
  });

export type FinancialStatementInput = z.infer<typeof financialStatementInputSchema>;

export const financialStatementListSchema = paginationSchema.extend({
  companyId: z.coerce.number().int().positive().optional(),
  fiscalYear: z.coerce.number().int().min(1990).max(2100).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  portalId: z.coerce.number().int().positive().optional(),
});
