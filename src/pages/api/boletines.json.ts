import type { APIRoute } from 'astro';
import { json } from '@/lib/api/respond';
import { listBoletinesPaged } from '@/server/repositories/boletinRepository';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const portalIdParam = url.searchParams.get('portalId');

    const result = await listBoletinesPaged({
      status: 'published',
      page: 1,
      limit: 100,
      portalId: portalIdParam ? Number(portalIdParam) : undefined, // 👈 Pasamos el portalId aquí
    });
    
    return json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    console.error('Error al generar boletines.json:', error);
    return json({ success: false, error: 'Error interno del servidor' }, 500);
  }
};