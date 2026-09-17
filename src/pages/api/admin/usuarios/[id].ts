import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { userUpdateSchema } from '@/lib/validations/user';
import { deleteUser, updateUser } from '@/server/services/userService';

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'usuarios', 'update', { json: true });
  const id = context.params.id ?? '';
  if (!id) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, userUpdateSchema);
  if (!body.ok) return body.response;
  return fromResult(await updateUser(id, body.data, actorFrom(context)));
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'usuarios', 'delete', { json: true });
  const id = context.params.id ?? '';
  if (!id) return json({ error: 'ID no válido' }, 400);
  return fromResult(await deleteUser(id, actorFrom(context)));
};
