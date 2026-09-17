import { publicRoute } from '@/server/api/publicRoute';
import { listBanners } from '@/server/services/publicApiService';

export const prerender = false;

/** Banners hero / slider de la página de inicio del portal, ordenados como carrusel (plan §19). */
export const ALL = publicRoute(async ({ portalSlug }) => {
  const data = await listBanners(portalSlug);
  return {
    body: { data },
    cache: 'public, s-maxage=120, stale-while-revalidate=240',
  };
});
