import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, intParam, json, readJson } from '@/lib/api/respond';
import { trainingInputSchema } from '@/lib/validations/training';
import { getTraining } from '@/server/repositories/trainingRepository';
import { deleteTraining, updateTraining } from '@/server/services/trainingService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'capacitaciones', 'view', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const dto = await getTraining(id);
  return dto ? json(dto) : json({ error: 'No encontrado' }, 404);
};

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'capacitaciones', 'update', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, trainingInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await updateTraining(id, body.data, actorFrom(context)));
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'capacitaciones', 'delete', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  return fromResult(await deleteTraining(id, actorFrom(context)));
};
