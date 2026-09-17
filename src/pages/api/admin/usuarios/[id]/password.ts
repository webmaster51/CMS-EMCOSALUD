import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { passwordResetSchema } from '@/lib/validations/user';
import { resetUserPassword } from '@/server/services/userService';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'usuarios', 'update', { json: true });
  const id = context.params.id ?? '';
  if (!id) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, passwordResetSchema);
  if (!body.ok) return body.response;
  return fromResult(await resetUserPassword(id, body.data.password, actorFrom(context)));
};
