import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { mediaRenameSchema } from '@/lib/validations/media';
import { deleteMedia, renameMedia } from '@/server/services/mediaService';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PATCH: APIRoute = async (context) => {
  const user = await requireResource(context, 'multimedia', 'update', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, mediaRenameSchema);
  if (!body.ok) return body.response;
  return fromResult(
    await renameMedia(id, body.data.internalName ?? null, {
      ...actorFrom(context),
      name: user.name,
    }),
  );
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'multimedia', 'delete', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  return fromResult(await deleteMedia(id, actorFrom(context)));
};
