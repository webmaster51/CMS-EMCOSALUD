import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, intParam, json, readJson } from '@/lib/api/respond';
import { portalInputSchema } from '@/lib/validations/portal';
import { deletePortal, updatePortal } from '@/server/services/portalService';

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'portales', 'update', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, portalInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await updatePortal(id, body.data, actorFrom(context)));
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'portales', 'delete', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  return fromResult(await deletePortal(id, actorFrom(context)));
};
