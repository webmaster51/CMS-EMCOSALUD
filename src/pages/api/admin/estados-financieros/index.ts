import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import {
  financialStatementInputSchema,
  financialStatementListSchema,
} from '@/lib/validations/financialStatement';
import { listPaged } from '@/server/repositories/financialStatementRepository';
import { createFinancialStatement } from '@/server/services/financialStatementService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'estados-financieros', 'view', { json: true });
  const parsed = financialStatementListSchema.safeParse(
    Object.fromEntries(context.url.searchParams),
  );
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  return json(await listPaged(parsed.data));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'estados-financieros', 'create', { json: true });
  const body = await readJson(context.request, financialStatementInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await createFinancialStatement(body.data, actorFrom(context)), 201);
};
