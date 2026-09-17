import { publicRoute } from '@/server/api/publicRoute';
import { publicListSchema } from '@/lib/validations/publicApi';
import { listBlog } from '@/server/services/publicApiService';

export const prerender = false;

export const ALL = publicRoute(async ({ context, portalSlug }) => {
  const q = publicListSchema.parse(Object.fromEntries(context.url.searchParams));
  return { body: await listBlog(portalSlug, q) };
});
