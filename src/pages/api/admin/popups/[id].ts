import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { popupInputSchema } from '@/lib/validations/popup';
import { getPopup } from '@/server/repositories/popupRepository';
import { deletePopup, updatePopup } from '@/server/services/popupService';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'popups', 'view', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  const dto = await getPopup(id);
  return dto ? json(dto) : json({ error: 'No encontrado' }, 404);
};

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'popups', 'update', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, popupInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await updatePopup(id, body.data, actorFrom(context)));
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'popups', 'delete', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  return fromResult(await deletePopup(id, actorFrom(context)));
};
