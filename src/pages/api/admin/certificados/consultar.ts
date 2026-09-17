import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client'; 
import { certificates } from '@/lib/db/schema'; // Asegúrate de que apunte a tu esquema de Drizzle de certificados
import { eq } from 'drizzle-orm';

export const prerender = false; // Importante para que corra dinámicamente en el servidor

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const documentNumber = url.searchParams.get('document');

  if (!documentNumber || !documentNumber.trim()) {
    return new Response(
      JSON.stringify({ error: 'Número de documento no proporcionado' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Consulta a tu base de datos local filtrando por el documento
    const results = await db
      .select()
      .from(certificates)
      .where(eq(certificates.documentNumber, documentNumber.trim()));

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Error en consulta pública]:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno al procesar la consulta' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};