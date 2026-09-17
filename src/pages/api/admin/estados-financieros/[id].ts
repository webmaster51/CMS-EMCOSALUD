import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, intParam, json, readJson } from '@/lib/api/respond';
import { financialStatementInputSchema } from '@/lib/validations/financialStatement';
import { get } from '@/server/repositories/financialStatementRepository';
import {
  deleteFinancialStatement,
  updateFinancialStatement,
} from '@/server/services/financialStatementService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'estados-financieros', 'view', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const dto = await get(id);
  return dto ? json(dto) : json({ error: 'No encontrado' }, 404);
};

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'estados-financieros', 'update', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, financialStatementInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await updateFinancialStatement(id, body.data, actorFrom(context)));
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'estados-financieros', 'delete', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);
  return fromResult(await deleteFinancialStatement(id, actorFrom(context)));
};
