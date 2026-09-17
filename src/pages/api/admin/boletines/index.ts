import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { boletinInputSchema, boletinListSchema } from '@/lib/validations/boletin';
import { listBoletinesPaged } from '@/server/repositories/boletinRepository';
import { createBoletin } from '@/server/services/boletinService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'boletines', 'view', { json: true });
  const parsed = boletinListSchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  return json(await listBoletinesPaged(parsed.data));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'boletines', 'create', { json: true });
  const body = await readJson(context.request, boletinInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await createBoletin(body.data, actorFrom(context)), 201);
};
