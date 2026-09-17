import { z } from 'zod';

export const categoryModuleSchema = z.enum(['blog', 'boletin', 'board', 'training']);
export type CategoryModule = z.infer<typeof categoryModuleSchema>;

export const categoryInputSchema = z.object({
  module: categoryModuleSchema,
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(96),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const categoryListSchema = z.object({
  module: categoryModuleSchema,
});
