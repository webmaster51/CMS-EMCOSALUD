import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client';
import { popups, portals, popupPortals } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ url, request }) => {
  const slug = url.searchParams.get('portal') || request.headers.get('x-portal-slug') || 'emcosalud';

  try {
    // 1. Buscar el portal por slug
    const portal = await db.query.portals.findFirst({
      where: and(
        eq(portals.slug, slug),
        eq(portals.status, 'active')
      ),
    });

    if (!portal) {
      return new Response(
        JSON.stringify({ error: 'Portal no encontrado o inactivo', slugBuscado: slug }), 
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Consultar los popups vinculados con status 'active'
    const results = await db
      .select({
        id: popups.id,
        title: popups.title,
        subtitle: popups.subtitle,
        description: popups.description,
        buttonText: popups.buttonText,
        url: popups.url,
        status: popups.status,
      })
      .from(popups)
      .innerJoin(popupPortals, eq(popups.id, popupPortals.popupId))
      .where(
        and(
          eq(popupPortals.portalId, portal.id),
          eq(popups.status, 'active') // <-- Corregido a 'active'
        )
      );

    return new Response(JSON.stringify({ data: results }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Error al consultar Drizzle', details: String(error) }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};