import { db } from '@/lib/db/client';// Ruta a tu instancia de Drizzle
import { certificates, media } from '@/lib/db/schema'; // Tu esquema
import { eq, and, SQL } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const documento = url.searchParams.get('doc') || '';
  const anio = url.searchParams.get('year') || '';
  const companyId = url.searchParams.get('portalId') || url.searchParams.get('company') || '1'; // <-- Recibimos el ID de la empresa

  if (!documento) {
    return new Response(JSON.stringify({ error: "Falta el número de documento" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const conditions: SQL[] = [
      eq(certificates.documentNumber, documento)
    ];

    // Si mandan el ID de la empresa, lo filtramos obligatoriamente
    if (companyId) {
      conditions.push(eq(certificates.companyId, Number(companyId)));
    }

    if (anio) {
      conditions.push(eq(certificates.taxYear, Number(anio)));
    }

    const resultados = await db
      .select({
        id: certificates.id,
        taxYear: certificates.taxYear,
        documentNumber: certificates.documentNumber,
        companyId: certificates.companyId,
        fullName: certificates.fullName,
        description: certificates.description,
        pdfFile: media.storageKey, 
      })
      .from(certificates)
      .leftJoin(media, eq(certificates.pdfMediaId, media.id))
      .where(and(...conditions));

    return new Response(JSON.stringify(resultados), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Error interno al consultar los certificados" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};