import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client';
import { popups, portals, popupPortals, popupPages, media } from '@/lib/db/schema';
import { eq, and, isNull  } from 'drizzle-orm';

export const prerender = false;

const MEDIA_BASE_URL = 'http://localhost:4321/media';

export const ALL: APIRoute = async ({ url, request }) => {
  // 1. OBTENEMOS EL SLUG EXCLUSIVAMENTE DE LA PETICIÓN (Sin valores quemados)
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
    // 2. BUSCAMos EL PORTAL DINÁMICAMENTE EN LA BASE DE DATOS
    const portal = await db.query.portals.findFirst({
      where: and(
        eq(portals.slug, portalSlug), // Busca exactamente el que mandó el portal (ej. 'sociedad-clinica-emcosalud')
        eq(portals.status, 'active')
      ),
    });

    if (!portal) {
      return new Response(
        JSON.stringify({ error: 'Portal no encontrado o inactivo', slugBuscado: portalSlug }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ... el resto de tu lógica de popups y filtros ...

    // 2. CONSULTAR POPUPS JUNTO CON SUS RUTAS ESPECÍFICAS DE popupPages
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
          isNull(popups.deletedAt) // <--- ¡ESTO EVITA QUE APAREZCAN LOS BORRADOS!
        )
      );

    const now = new Date();

    const data = activePopups
      .filter((popup) => {
        // Validación de fechas
        if (popup.startsAt && new Date(popup.startsAt) > now) return false;
        if (popup.endsAt && new Date(popup.endsAt) < now) return false;

        const mode = popup.pageMode as string;

        // Caso A: Solo en el inicio ('/')
        if (mode === 'home_only') {
          return currentPath === '/' || currentPath === '';
        }

        // Caso B: En todo el sitio
        if (mode === 'all_pages' || !mode) {
          return true;
        }

        // Caso C: En páginas específicas (validamos contra la tabla popupPages)
        if (mode === 'specific_pages') {
          // Compara si la ruta actual coincide con la ruta guardada en la base de datos para este popup
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