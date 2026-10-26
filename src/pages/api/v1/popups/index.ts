import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client';
import { popups, portals, popupPortals, popupPages, media } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export const prerender = false;

export const ALL: APIRoute = async ({ url, request }) => {
  // Definimos la base URL aquí adentro, donde 'url' ya está disponible
  const baseUrl = process.env.APP_URL || url.origin;
  const MEDIA_BASE_URL = `${baseUrl}/media`;

  // 1. OBTENEMOS EL SLUG EXCLUSIVAMENTE DE LA PETICIÓN
  const portalSlug = 
    request.headers.get('x-portal-slug') || 
    url.searchParams.get('portal');

  // Si no envían ningún slug, rechazamos la petición inmediatamente
  if (!portalSlug) {
    return new Response(
      JSON.stringify({ error: 'Falta el parámetro o header del slug del portal' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const currentPath = url.searchParams.get('path') || '/';

  try {
    // 2. BUSCAMOS EL PORTAL DINÁMICAMENTE EN LA BASE DE DATOS
    const portal = await db.query.portals.findFirst({
      where: and(
        eq(portals.slug, portalSlug),
        eq(portals.status, 'active')
      ),
    });

    if (!portal) {
      return new Response(
        JSON.stringify({ error: 'Portal no encontrado o inactivo', slugBuscado: portalSlug }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. CONSULTAR POPUPS
    const activePopups = await db
      .select({
        id: popups.id,
        title: popups.title,
        subtitle: popups.subtitle,
        description: popups.description,
        buttonText: popups.buttonText,
        url: popups.url,
        status: popups.status,
        pageMode: popups.pageMode,        
        frequency: popups.frequency,      
        frequencyDays: popups.frequencyDays,
        startsAt: popups.startsAt,
        endsAt: popups.endsAt,
        device: popups.device,            
        priority: popups.priority,
        storageKey: media.storageKey,
        specificPath: popupPages.path,    
      })
      .from(popups)
      .innerJoin(popupPortals, eq(popups.id, popupPortals.popupId))
      .leftJoin(media, eq(popups.imageMediaId, media.id))
      .leftJoin(popupPages, eq(popups.id, popupPages.popupId))
      .where(
        and(
          eq(popupPortals.portalId, portal.id),
          eq(popups.status, 'active'),
          isNull(popups.deletedAt)
        )
      );

    const now = new Date();

    const data = activePopups
      .filter((popup) => {
        if (popup.startsAt && new Date(popup.startsAt) > now) return false;
        if (popup.endsAt && new Date(popup.endsAt) < now) return false;

        const mode = popup.pageMode as string;

        if (mode === 'home_only') {
          return currentPath === '/' || currentPath === '';
        }

        if (mode === 'all_pages' || !mode) {
          return true;
        }

        if (mode === 'specific_pages') {
          return popup.specificPath === currentPath;
        }

        return false;
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