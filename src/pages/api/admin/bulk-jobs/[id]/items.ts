import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireResource } from '@/lib/auth/session';
import { json } from '@/lib/api/respond';
import { paginationSchema } from '@/lib/validations/common';
import { listItems } from '@/server/repositories/bulkJobRepository';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const querySchema = paginationSchema.extend({
  status: z.enum(['pending', 'ok', 'error', 'skipped']).optional(),
});

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'view', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  const parsed = querySchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  return json(await listItems(id, parsed.data));
};
