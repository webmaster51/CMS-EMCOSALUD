import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { popupInputSchema, popupListSchema } from '@/lib/validations/popup';
import { listPopupsPaged } from '@/server/repositories/popupRepository';
import { createPopup } from '@/server/services/popupService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'popups', 'view', { json: true });
  const parsed = popupListSchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  return json(await listPopupsPaged(parsed.data));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'popups', 'create', { json: true });
  const body = await readJson(context.request, popupInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await createPopup(body.data, actorFrom(context)), 201);
};
