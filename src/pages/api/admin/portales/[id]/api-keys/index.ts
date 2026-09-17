import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, intParam, json, readJson } from '@/lib/api/respond';
import { apiKeyInputSchema } from '@/lib/validations/portal';
import { listApiKeys } from '@/server/repositories/portalRepository';
import { createApiKey } from '@/server/services/portalService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'portales', 'view', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  return json(await listApiKeys(id));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'portales', 'update', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, apiKeyInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await createApiKey(id, body.data, actorFrom(context)), 201);
};
