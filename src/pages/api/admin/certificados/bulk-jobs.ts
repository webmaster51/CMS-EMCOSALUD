import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client';
import { bulkJobs } from '@/lib/db/schema';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();

    const userId = locals.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Conversión estricta de tipos para evitar el error de Zod/TypeScript
    const companyId = body.companyId ? Number(body.companyId) : NaN;
    const taxYear = body.taxYear ? Number(body.taxYear) : NaN;
    const patternId = body.patternId !== '' && body.patternId != null ? Number(body.patternId) : null;
    const kind = body.kind;
    const description = body.description ? String(body.description).trim() : null;

    if (isNaN(companyId) || isNaN(taxYear) || !kind) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos obligatorios o son inválidos (companyId, taxYear, kind)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const [job] = await db
      .insert(bulkJobs)
      .values({
        companyId,
        taxYear,
        patternId,
        kind,
        description,
        status: 'queued',
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        createdBy: userId,
      })
      .returning({ id: bulkJobs.id });

    if (!job) {
      throw new Error('No se pudo crear el trabajo masivo en la base de datos');
    }

    return new Response(JSON.stringify({ id: job.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error detallado en /api/admin/bulk-jobs:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno al crear el bulk job' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};