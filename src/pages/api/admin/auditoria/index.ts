import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { json } from '@/lib/api/respond';
import { auditListSchema } from '@/lib/validations/audit';
import { auditFacets, listAuditPaged } from '@/server/repositories/auditRepository';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'auditoria', 'view', { json: true });
  const parsed = auditListSchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  const [page, facets] = await Promise.all([
    listAuditPaged(parsed.data),
    context.url.searchParams.get('facets') === '1'
      ? auditFacets()
      : Promise.resolve(undefined),
  ]);
  return json(facets ? { ...page, facets } : page);
};
