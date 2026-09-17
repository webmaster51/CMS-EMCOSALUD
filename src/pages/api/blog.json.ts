import type { APIRoute } from 'astro';
import { listBlogPaged } from '@/server/repositories/blogRepository';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 20;
    
    // Obtenemos los posts publicados utilizando el repositorio existente
    const result = await listBlogPaged({
      status: 'published',
      page,
      limit,
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