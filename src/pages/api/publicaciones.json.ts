import type { APIRoute } from 'astro';
import { json } from '@/lib/api/respond';
import { listBoardPublicationsPaged } from '@/server/repositories/boardPublicationRepository';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // Usamos el repositorio existente filtrando por estado publicado
    const result = await listBoardPublicationsPaged({
      status: 'published',
      page: 1,
      limit: 100, // Ajusta el límite si requieres más elementos
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