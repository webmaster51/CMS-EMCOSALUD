import { z } from 'zod';

/**
 * Distribución multiportal compartida por boletines, publicaciones, blog,
 * capacitaciones y popups (plan §5.1).
 *
 *   specific → exactamente 1 portal
 *   general  → 1..N portales seleccionados
 *   all      → todos los portales (presentes y futuros); portalIds se ignora
 */
export const distributionFields = {
  distributionType: z.enum(['specific', 'general', 'all']),
  portalIds: z.array(z.number().int().positive()),
};

export interface DistributionValue {
  distributionType: 'specific' | 'general' | 'all';
  portalIds: number[];
}

/** Regla de validación para usar en `.superRefine` de cualquier esquema de contenido. */
export function refineDistribution(val: DistributionValue, ctx: z.RefinementCtx): void {
  if (val.distributionType === 'specific' && val.portalIds.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['portalIds'],
      message: 'Elige exactamente un portal',
    });
  }
  if (val.distributionType === 'general' && val.portalIds.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['portalIds'],
      message: 'Selecciona al menos un portal',
    });
  }
}

export const distributionSchema = z.object(distributionFields).superRefine(refineDistribution);
export type Distribution = z.infer<typeof distributionSchema>;

/** Normaliza los ids de portal según el tipo (all ⇒ vacío, sin duplicados). */
export function normalizeDistribution(d: DistributionValue): DistributionValue {
  return {
    distributionType: d.distributionType,
    portalIds: d.distributionType === 'all' ? [] : Array.from(new Set(d.portalIds)),
  };
}
