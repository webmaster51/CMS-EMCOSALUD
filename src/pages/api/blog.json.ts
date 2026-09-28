import type { APIRoute } from 'astro';
import { listBlogPaged } from '@/server/repositories/blogRepository';
import { db } from '@/lib/db/client';
import { portals } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 20;
    
    // 1. Obtener el slug del portal de la URL (por defecto 'emcosalud')
    const portalSlug = url.searchParams.get('portal') || 'emcosalud';
    
    // 2. Buscar el portal en la base de datos para obtener su ID numérico
    const portalRecord = await db.query.portals.findFirst({
      where: and(eq(portals.slug, portalSlug), eq(portals.status, 'active')),
    });

    if (!portalRecord) {
      return new Response(
        JSON.stringify({ success: false, error: 'Portal no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Pasar el ID numérico al repositorio
    const result = await listBlogPaged({
      status: 'published',
      page,
      limit,
      portalId: portalRecord.id, // <--- Aquí pasas el número exacto que pide TypeScript
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: result.data,
        meta: result.meta,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error al generar blog.json:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno del servidor',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};