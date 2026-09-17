import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult } from '@/lib/api/respond';
import { deleteCertificate } from '@/server/services/certificateService';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'delete', { json: true });

  const body = await context.request.json().catch(() => null);
  const ids = body?.ids;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return new Response(JSON.stringify({ error: 'No se proporcionaron IDs válidos' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const actor = actorFrom(context);

  for (const id of ids) {
    const result = await deleteCertificate(Number(id), actor);
    // Si la función fromResult ya maneja el tipo de respuesta, la puedes usar directamente:
    // O si prefieres validar el error, revisa si el tipado usa 'ok' o 'error'.
    // Como deleteCertificate devuelve un ServiceResult, podemos evaluarlo con fromResult:
    const res = fromResult(result);
    if (!res.ok && res.status !== 200) {
      return res;
    }
  }

  return new Response(JSON.stringify({ success: true, message: 'Certificados eliminados correctamente' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};