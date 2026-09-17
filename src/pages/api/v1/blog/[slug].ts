import { publicRoute } from '@/server/api/publicRoute';
import { getBlogPostBySlug } from '@/server/services/publicApiService';

export const prerender = false;

export const ALL = publicRoute(async ({ context, portalSlug }) => {
  const slug = context.params.slug ?? '';
  const post = await getBlogPostBySlug(portalSlug, slug);
  if (!post) {
    throw new Response(JSON.stringify({ error: 'Artículo no encontrado' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  return { body: post };
});
