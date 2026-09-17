import type { APIContext } from 'astro';

export const PORTAL_COOKIE = 'cms_portal';

/**
 * Portal seleccionado en el filtro global del panel.
 * Orden de resolución: query `?portal=` → cookie `cms_portal` → null (= "Todos").
 * `null` significa que el Dashboard y las listas muestran datos de todos los portales.
 */
export function getSelectedPortalSlug(context: APIContext): string | null {
  const fromQuery = context.url.searchParams.get('portal');
  if (fromQuery) return fromQuery === '__all__' ? null : fromQuery;
  const fromCookie = context.cookies.get(PORTAL_COOKIE)?.value;
  return fromCookie && fromCookie !== '__all__' ? fromCookie : null;
}
