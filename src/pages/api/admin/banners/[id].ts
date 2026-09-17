import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { bannerInputSchema } from '@/lib/validations/banner';
import { getBanner } from '@/server/repositories/bannerRepository';
import { deleteBanner, updateBanner } from '@/server/services/bannerService';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'banners', 'view', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  const dto = await getBanner(id);
  return dto ? json(dto) : json({ error: 'No encontrado' }, 404);
};

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'banners', 'update', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, bannerInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await updateBanner(id, body.data, actorFrom(context)));
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'banners', 'delete', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  return fromResult(await deleteBanner(id, actorFrom(context)));
};
