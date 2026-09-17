import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, intParam, json, readJson } from '@/lib/api/respond';
import { boletinInputSchema } from '@/lib/validations/boletin';
import { getBoletin } from '@/server/repositories/boletinRepository';
import { deleteBoletin, updateBoletin } from '@/server/services/boletinService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'boletines', 'view', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const dto = await getBoletin(id);
  return dto ? json(dto) : json({ error: 'No encontrado' }, 404);
};

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'boletines', 'update', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, boletinInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await updateBoletin(id, body.data, actorFrom(context)));
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'boletines', 'delete', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  return fromResult(await deleteBoletin(id, actorFrom(context)));
};
