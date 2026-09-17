import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, intParam, json, readJson } from '@/lib/api/respond';
import { boardPublicationInputSchema } from '@/lib/validations/boardPublication';
import { getBoardPublication } from '@/server/repositories/boardPublicationRepository';
import {
  deleteBoardPublication,
  updateBoardPublication,
} from '@/server/services/boardPublicationService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'publicaciones', 'view', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const dto = await getBoardPublication(id);
  return dto ? json(dto) : json({ error: 'No encontrado' }, 404);
};

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'publicaciones', 'update', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, boardPublicationInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await updateBoardPublication(id, body.data, actorFrom(context)));
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'publicaciones', 'delete', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  return fromResult(await deleteBoardPublication(id, actorFrom(context)));
};
