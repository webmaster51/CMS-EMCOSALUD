import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, intParam, json, readJson } from '@/lib/api/respond';
import { deletePattern, setPatternEnabled } from '@/server/repositories/certificateRepository';
import { recordAudit } from '@/server/services/auditService';

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'update', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, z.object({ enabled: z.boolean() }));
  if (!body.ok) return body.response;
  await setPatternEnabled(id, body.data.enabled);
  await recordAudit({
    action: 'update',
    module: 'certificados',
    entityType: 'filename_pattern',
    entityId: id,
    summary: `${body.data.enabled ? 'Activó' : 'Desactivó'} un patrón de nombre`,
    ...actorFrom(context),
  });
  return json({ id, enabled: body.data.enabled });
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'delete', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  await deletePattern(id);
  await recordAudit({
    action: 'delete',
    module: 'certificados',
    entityType: 'filename_pattern',
    entityId: id,
    summary: 'Eliminó un patrón de nombre',
    ...actorFrom(context),
  });
  return json({ id });
};
