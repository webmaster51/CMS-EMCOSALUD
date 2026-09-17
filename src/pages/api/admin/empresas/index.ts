import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { paginationSchema } from '@/lib/validations/common';
import { companyInputSchema } from '@/lib/validations/company';
import { listCompaniesPaged } from '@/server/repositories/companyRepository';
import { createCompany } from '@/server/services/companyService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'empresas', 'view', { json: true });
  const params = paginationSchema.parse(Object.fromEntries(context.url.searchParams));
  return json(await listCompaniesPaged(params));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'empresas', 'create', { json: true });
  const body = await readJson(context.request, companyInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await createCompany(body.data, actorFrom(context)), 201);
};
