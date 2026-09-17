import type { APIRoute } from 'astro';
import { count } from 'drizzle-orm';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, json, readJson } from '@/lib/api/respond';
import { appSettingsSchema } from '@/lib/validations/settings';
import { getEnv } from '@/lib/env';
import { db } from '@/lib/db/client';
import { portals, users } from '@/lib/db/schema';
import { getAppSettings, saveAppSettings } from '@/server/repositories/settingsRepository';
import { recordAudit } from '@/server/services/auditService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'configuracion', 'view', { json: true });
  const env = getEnv();
  const [settings, [userCount], portalRows] = await Promise.all([
    getAppSettings(),
    db.select({ n: count() }).from(users),
    db
      .select({ name: portals.name, hasHook: portals.deployHookUrl, status: portals.status })
      .from(portals),
  ]);

  return json({
    settings,
    info: {
      appUrl: env.APP_URL,
      timezone: env.APP_TIMEZONE,
      dbDriver: env.DB_DRIVER,
      storageDriver: env.STORAGE_DRIVER,
      nodeEnv: env.NODE_ENV,
      users: userCount?.n ?? 0,
      maxFileSizeMb: Math.round(env.MAX_FILE_SIZE / 1024 / 1024),
      portals: portalRows.map((p) => ({
        name: p.name,
        status: p.status,
        deployHook: Boolean(p.hasHook),
      })),
    },
  });
};

export const PUT: APIRoute = async (context) => {
  const user = await requireResource(context, 'configuracion', 'update', { json: true });
  const body = await readJson(context.request, appSettingsSchema);
  if (!body.ok) return body.response;
  const saved = await saveAppSettings(body.data, user.id);
  await recordAudit({
    action: 'update',
    module: 'configuracion',
    entityType: 'settings',
    summary: 'Actualizó la configuración general',
    metadata: saved,
    ...actorFrom(context),
  });
  return json(saved);
};
