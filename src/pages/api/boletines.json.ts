import type { APIRoute } from 'astro';
import { json } from '@/lib/api/respond';
import { listBoletinesPaged } from '@/server/repositories/boletinRepository';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const result = await listBoletinesPaged({
      status: 'published',
      page: 1,
      limit: 100,
    });
    
    return json({
      success: true,
      data: result.data,
      meta: result.meta // Usamos .meta en lugar de .pagination
    });
  } catch (error) {
    console.error('Error al generar boletines.json:', error);
    return json({ success: false, error: 'Error interno del servidor' }, 500);
  }
};