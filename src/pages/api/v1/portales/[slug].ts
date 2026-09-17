import { publicRoute } from '@/server/api/publicRoute';
import { getPortal } from '@/server/services/publicApiService';

export const prerender = false;

/** Metadata pública de un portal. Solo se puede consultar el propio de la clave. */
export const ALL = publicRoute(async ({ context, portalSlug }) => {
  const slug = context.params.slug ?? '';
  if (slug !== portalSlug) {
    throw new Response(JSON.stringify({ error: 'Portal no autorizado para esta clave' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
  const portal = await getPortal(slug);
  if (!portal) {
    throw new Response(JSON.stringify({ error: 'Portal no encontrado' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  return { body: portal };
});
