import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { trainingInputSchema, trainingListSchema } from '@/lib/validations/training';
import { listTrainingPaged } from '@/server/repositories/trainingRepository';
import { createTraining } from '@/server/services/trainingService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'capacitaciones', 'view', { json: true });
  const parsed = trainingListSchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  return json(await listTrainingPaged(parsed.data));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'capacitaciones', 'create', { json: true });
  const body = await readJson(context.request, trainingInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await createTraining(body.data, actorFrom(context)), 201);
};
