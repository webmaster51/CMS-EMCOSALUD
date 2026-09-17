import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { userCreateSchema, userListSchema } from '@/lib/validations/user';
import { listUsersPaged } from '@/server/repositories/userRepository';
import { createUser } from '@/server/services/userService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'usuarios', 'view', { json: true });
  const parsed = userListSchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  return json(await listUsersPaged(parsed.data));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'usuarios', 'create', { json: true });
  const body = await readJson(context.request, userCreateSchema);
  if (!body.ok) return body.response;
  return fromResult(await createUser(body.data, actorFrom(context)), 201);
};
