import type { APIRoute } from 'astro';
import { json } from '@/lib/api/respond';
import { listBoardPublicationsPaged } from '@/server/repositories/boardPublicationRepository';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const portalIdParam = url.searchParams.get('portalId');

    // Usamos el repositorio existente filtrando por estado y portalId
    const result = await listBoardPublicationsPaged({
      status: 'published',
      page: 1,
      limit: 100, // Ajusta el límite si requieres más elementos
      portalId: portalIdParam ? Number(portalIdParam) : undefined, // 👈 Pasamos el portalId aquí
    });
    
    return json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    console.error('Error al generar publicaciones.json:', error);
    return json({ success: false, error: 'Error interno del servidor' }, 500);
  }
};