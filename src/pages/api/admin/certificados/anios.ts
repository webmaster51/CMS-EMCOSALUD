import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { json } from '@/lib/api/respond';
import { distinctTaxYears } from '@/server/repositories/certificateRepository';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'view', { json: true });
  const raw = context.url.searchParams.get('companyId');
  const companyId = raw ? Number(raw) : undefined;
  return json(await distinctTaxYears(Number.isInteger(companyId) ? companyId : undefined));
};
