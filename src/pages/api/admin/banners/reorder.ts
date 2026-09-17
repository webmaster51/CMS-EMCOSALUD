import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, readJson } from '@/lib/api/respond';
import { bannerReorderSchema } from '@/lib/validations/banner';
import { reorderBanners } from '@/server/services/bannerService';

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'banners', 'update', { json: true });
  const body = await readJson(context.request, bannerReorderSchema);
  if (!body.ok) return body.response;
  return fromResult(await reorderBanners(body.data.ids, actorFrom(context)));
};
