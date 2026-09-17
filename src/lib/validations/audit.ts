import { z } from 'zod';
import { paginationSchema } from './common';

export const auditListSchema = paginationSchema.extend({
  module: z.string().trim().max(48).optional(),
  action: z.string().trim().max(64).optional(),
  userId: z.string().trim().max(64).optional(),
  entityType: z.string().trim().max(48).optional(),
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
});
export type AuditListParams = z.infer<typeof auditListSchema>;
