import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client';
import { popups, portals, popupPortals, media } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const prerender = false;

const MEDIA_BASE_URL = 'http://localhost:4321/media';

export const ALL: APIRoute = async ({ url, request }) => {
  const portalSlug = 
    request.headers.get('x-portal-slug') || 
    url.searchParams.get('portal') || 
    'emcosalud';

  try {
    const portal = await db.query.portals.findFirst({
      where: and(
        eq(portals.slug, portalSlug),
        eq(portals.status, 'active')
      ),
    });

    if (!portal) {
      return new Response(
        JSON.stringify({ error: 'Portal no encontrado o inactivo', slug: portalSlug }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const activePopups = await db
      .select({
        id: popups.id,
        title: popups.title,
        subtitle: popups.subtitle,
        description: popups.description,
        buttonText: popups.buttonText,
        url: popups.url,
        status: popups.status,
        // Campos de reglas de visibilidad del CMS
        pageMode: popups.pageMode,          // 'all_pages', 'home_only', etc.
        frequency: popups.frequency,        // 'always', 'once_per_session', 'once_per_day'
        frequencyDays: popups.frequencyDays,
        startsAt: popups.startsAt,
        endsAt: popups.endsAt,
        device: popups.device,              // 'all', 'desktop', 'mobile'
        priority: popups.priority,
        storageKey: media.storageKey,
      })
      .from(popups)
      .innerJoin(popupPortals, eq(popups.id, popupPortals.popupId))
      .leftJoin(media, eq(popups.imageMediaId, media.id))
      .where(
        and(
          eq(popupPortals.portalId, portal.id),
          eq(popups.status, 'active')
        )
      );

    const now = new Date();

    const data = activePopups
      // Filtra popups que estén fuera del rango de fechas si se definieron en el CMS
      .filter((popup) => {
        if (popup.startsAt && new Date(popup.startsAt) > now) return false;
        if (popup.endsAt && new Date(popup.endsAt) < now) return false;
        return true;
      })
      .map((popup) => ({
        ...popup,
        imageUrl: popup.storageKey ? `${MEDIA_BASE_URL}/${popup.storageKey}` : null,
      }));

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Portal-Slug',
      },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Error interno en la API', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};