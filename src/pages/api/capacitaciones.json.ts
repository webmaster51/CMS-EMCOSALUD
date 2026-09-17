import type { APIRoute } from 'astro';
import { json } from '@/lib/api/respond';
import { listTrainingPaged } from '@/server/repositories/trainingRepository';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    
    // 1. Capturamos el portalId que envía el frontend (ej: ?portalId=1)
    const portalIdParam = url.searchParams.get('portalId');
    const portalId = portalIdParam ? parseInt(portalIdParam, 10) : undefined;

    // 2. Se lo pasamos al repositorio junto con el estatus publicado
    const result = await listTrainingPaged({
      status: 'published',
      portalId, // <--- Aquí va el filtro que el repositorio ya sabe procesar
      page,
      limit,
    });
    
    return json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    console.error('Error al generar json de capacitaciones:', error);
    return json({ success: false, error: 'Error interno del servidor' }, 500);
  }
};