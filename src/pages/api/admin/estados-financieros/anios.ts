import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { json } from '@/lib/api/respond';
import { distinctYears } from '@/server/repositories/financialStatementRepository';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'estados-financieros', 'view', { json: true });
  const raw = context.url.searchParams.get('companyId');
  const companyId = raw ? Number(raw) : undefined;
  return json(await distinctYears(Number.isInteger(companyId) ? companyId : undefined));
};
