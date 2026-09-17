import { z } from 'zod';

export const companyInputSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(160),
  shortName: z.string().trim().min(1, 'Requerido').max(60),
  taxId: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(32)
    .regex(/^[0-9A-Za-z.-]+$/, 'Solo dígitos, letras, puntos y guiones'),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']),
  logoMediaId: z.string().uuid().nullable().optional(),
});

export type CompanyInput = z.infer<typeof companyInputSchema>;

/** Normaliza el NIT quitando puntos y espacios para comparar duplicados. */
export function normalizeTaxId(taxId: string): string {
  return taxId.replace(/[.\s]/g, '').toLowerCase();
}
