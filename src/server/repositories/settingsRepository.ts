import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import {
  DEFAULT_SETTINGS,
  appSettingsSchema,
  type AppSettings,
} from '@/lib/validations/settings';

const KEY = 'app';

export async function getAppSettings(): Promise<AppSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
  if (!row) return DEFAULT_SETTINGS;
  const parsed = appSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(row.value as object) });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveAppSettings(
  value: AppSettings,
  updatedBy: string | null,
): Promise<AppSettings> {
  await db
    .insert(settings)
    .values({ key: KEY, value, updatedBy })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedBy, updatedAt: sql`now()` },
    });
  return value;
}
