import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { bannerInputSchema, bannerListSchema } from '@/lib/validations/banner';
import { listBannersPaged } from '@/server/repositories/bannerRepository';
import { createBanner } from '@/server/services/bannerService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'banners', 'view', { json: true });
  const parsed = bannerListSchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  return json(await listBannersPaged(parsed.data));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'banners', 'create', { json: true });
  const body = await readJson(context.request, bannerInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await createBanner(body.data, actorFrom(context)), 201);
};
