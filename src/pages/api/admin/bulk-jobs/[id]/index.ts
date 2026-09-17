import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { json } from '@/lib/api/respond';
import { getJobDTO } from '@/server/repositories/bulkJobRepository';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'view', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  const dto = await getJobDTO(id);
  return dto ? json(dto) : json({ error: 'No encontrado' }, 404);
};
