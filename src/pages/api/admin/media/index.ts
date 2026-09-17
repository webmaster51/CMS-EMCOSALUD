import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json } from '@/lib/api/respond';
import { mediaListSchema } from '@/lib/validations/media';
import { listMediaPaged } from '@/server/repositories/mediaRepository';
import { uploadMedia } from '@/server/services/mediaService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'multimedia', 'view', { json: true });
  const parsed = mediaListSchema.safeParse(
    Object.fromEntries(context.url.searchParams),
  );
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  return json(await listMediaPaged(parsed.data));
};

export const POST: APIRoute = async (context) => {
  const user = await requireResource(context, 'multimedia', 'create', { json: true });

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return json({ error: 'Se esperaba multipart/form-data' }, 400);
  }
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'Falta el archivo' }, 400);

  const internalName = form.get('internalName');
  const actor = {
    ...actorFrom(context),
    name: user.name,
  };
  return fromResult(
    await uploadMedia(
      file,
      typeof internalName === 'string' ? internalName : null,
      actor,
    ),
    201,
  );
};
