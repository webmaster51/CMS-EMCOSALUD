import { z } from 'zod';

export const appSettingsSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),
  supportEmail: z.string().trim().email().or(z.literal('')),
  defaultPageSize: z.coerce.number().int().min(5).max(100),
  blogWebhookEnabled: z.boolean(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  organizationName: 'EMCO SALUD Grupo Empresarial',
  supportEmail: '',
  defaultPageSize: 20,
  blogWebhookEnabled: true,
};
