import { z } from 'zod';
import { paginationSchema } from './common';

export const userRoleSchema = z.enum(['superadmin', 'editor']);

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  email: z.string().trim().email('Correo no válido').max(160),
  password: z.string().min(10, 'Mínimo 10 caracteres').max(200),
  role: userRoleSchema,
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: userRoleSchema,
  status: z.enum(['active', 'suspended']),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const passwordResetSchema = z.object({
  password: z.string().min(10, 'Mínimo 10 caracteres').max(200),
});

export const userListSchema = paginationSchema.extend({
  role: userRoleSchema.optional(),
  status: z.enum(['active', 'suspended']).optional(),
});
