import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, intParam, json, readJson } from '@/lib/api/respond';
import { companyInputSchema } from '@/lib/validations/company';
import { deleteCompany, updateCompany } from '@/server/services/companyService';

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'empresas', 'update', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, companyInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await updateCompany(id, body.data, actorFrom(context)));
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'empresas', 'delete', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  return fromResult(await deleteCompany(id, actorFrom(context)));
};
