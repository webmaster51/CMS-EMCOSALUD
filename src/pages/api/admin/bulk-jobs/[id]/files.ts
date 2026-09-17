import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { fromResult, json } from '@/lib/api/respond';
import { addFiles } from '@/server/services/bulkUploadService';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sube un lote de PDFs individuales a una carga (modo multi_pdf). */
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
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return json({ error: 'Sin archivos' }, 400);

  const buffers = await Promise.all(
    files.map(async (f) => ({ name: f.name, bytes: Buffer.from(await f.arrayBuffer()) })),
  );
  return fromResult(await addFiles(id, buffers));
};
