import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, intParam, json } from '@/lib/api/respond';
import { revokeApiKey } from '@/server/services/portalService';

export const prerender = false;

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'portales', 'update', { json: true });
  const portalId = intParam(context.params.id);
  const keyId = intParam(context.params.keyId);
  if (!portalId || !keyId) return json({ error: 'ID no válido' }, 400);
  return fromResult(await revokeApiKey(portalId, keyId, actorFrom(context)));
};
