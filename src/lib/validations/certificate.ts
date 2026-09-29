import { z } from 'zod';
import { paginationSchema } from './common';

const yearSchema = z.coerce.number().int().min(1990).max(2100);

// Validación de fecha YYYY-MM-DD requerida o que admita timestamps de entrada
const requiredDate = z
  .string({ required_error: 'La fecha es requerida' })
  .trim()
  .min(1, 'Ingresa una fecha válida');

export const certificateInputSchema = z.object({
  companyId: z.number().int().positive(),
  taxYear: yearSchema,
  documentNumber: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(32)
    .regex(/^[0-9A-Za-z.-]+$/, 'Solo dígitos, letras, puntos y guiones'),

  // ✅ Permitir opcional o null para que el Bulk Job no falle si solo lee el documento
  fullName: z
    .string()
    .trim()
    .max(200, 'Máximo 200 caracteres')
    .nullable()
    .optional(),

  description: z.string().trim().max(500, 'Máximo 500 caracteres').nullable().optional(),
  pdfMediaId: z.string().uuid('Selecciona el PDF'),
  status: z.enum(['active', 'inactive']),
  issuedDate: requiredDate,
});

export type CertificateInput = z.infer<typeof certificateInputSchema>;

export const certificateListSchema = paginationSchema.extend({
  companyId: z.coerce.number().int().positive().optional(),
  taxYear: z.coerce.number().int().min(1990).max(2100).optional(),
  document: z.string().trim().max(32).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const bulkJobCreateSchema = z.object({
  companyId: z.number().int().positive(),
  taxYear: yearSchema,
  
  // CAMBIO 2: Se acepta la descripción al crear el Job masivo
  description: z.string().trim().max(500).nullable().optional(),
  
  patternId: z.number().int().positive().nullable().optional(),
  kind: z.enum(['multi_pdf', 'zip', 'csv_zip']),
});

export type BulkJobCreate = z.infer<typeof bulkJobCreateSchema>;

export const filenamePatternInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  regex: z.string().trim().min(3).max(500),
  documentGroup: z.string().trim().min(1).max(40),
  
  // CAMBIO 3: Se añade la captura del grupo del nombre completo en Regex para carga masiva
  nameGroup: z.string().trim().max(40).optional().or(z.literal('')).nullable(),
  
  yearGroup: z.string().trim().max(40).optional().or(z.literal('')).nullable(),
  enabled: z.boolean(),
});

export type FilenamePatternInput = z.infer<typeof filenamePatternInputSchema>;