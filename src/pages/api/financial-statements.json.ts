import { db } from '@/lib/db/client'; 
import { financialStatements, financialStatementFiles, financialStatementPortals, media } from '@/lib/db/schema';
import { eq, and, SQL, exists, or, isNull  } from 'drizzle-orm';
import type { APIRoute } from 'astro';


export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const companyId = url.searchParams.get('company') || ''; // ID de la empresa seleccionada
  const anio = url.searchParams.get('year') || '';         // Año fiscal opcional

  if (!companyId) {
    return new Response(JSON.stringify({ error: "Falta el ID de la empresa" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const conditions: SQL[] = [
      eq(financialStatements.companyId, Number(companyId)),
      eq(financialStatements.status, 'published'), // Solo los publicados para el público
      isNull(financialStatements.deletedAt)        // Que no estén eliminados lógicamente
    ];

    if (anio) {
      conditions.push(eq(financialStatements.fiscalYear, Number(anio)));
    }

    // Consultamos los estados financieros junto con sus archivos adjuntos y la tabla media
    const resultados = await db
      .select({
        id: financialStatements.id,
        fiscalYear: financialStatements.fiscalYear,
        title: financialStatements.title,
        summary: financialStatements.summary,
        publishedDate: financialStatements.publishedDate,
        fileLabel: financialStatementFiles.label,
        pdfFile: media.storageKey, 
      })
      .from(financialStatements)
      .leftJoin(
        financialStatementFiles, 
        eq(financialStatements.id, financialStatementFiles.financialStatementId)
      )
      .leftJoin(
        media, 
        eq(financialStatementFiles.mediaId, media.id)
      )
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
    return new Response(JSON.stringify({ error: "Error interno al consultar los estados financieros" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};