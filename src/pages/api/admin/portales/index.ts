import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { paginationSchema } from '@/lib/validations/common';
import { portalInputSchema } from '@/lib/validations/portal';
import { listPortalsPaged } from '@/server/repositories/portalRepository';
import { createPortal } from '@/server/services/portalService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'portales', 'view', { json: true });
  const params = paginationSchema.parse(
    Object.fromEntries(context.url.searchParams),
  );
  return json(await listPortalsPaged(params));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'portales', 'create', { json: true });
  const body = await readJson(context.request, portalInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await createPortal(body.data, actorFrom(context)), 201);
};
