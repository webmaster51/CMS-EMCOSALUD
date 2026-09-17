import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { fromResult, json } from '@/lib/api/respond';
import { attachPlanilla } from '@/server/services/bulkUploadService';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sube la planilla CSV/Excel para el matching por nombre (modo csv_zip). */
export const POST: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'create', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return json({ error: 'Se esperaba multipart/form-data' }, 400);
  }
  const file = form.get('planilla');
  if (!(file instanceof File)) return json({ error: 'Falta la planilla' }, 400);

  return fromResult(
    await attachPlanilla(id, file.name, Buffer.from(await file.arrayBuffer())),
  );
};
