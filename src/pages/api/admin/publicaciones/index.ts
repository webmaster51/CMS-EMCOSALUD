import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import {
  boardPublicationInputSchema,
  boardPublicationListSchema,
} from '@/lib/validations/boardPublication';
import { listBoardPublicationsPaged } from '@/server/repositories/boardPublicationRepository';
import { createBoardPublication } from '@/server/services/boardPublicationService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'publicaciones', 'view', { json: true });
  const parsed = boardPublicationListSchema.safeParse(
    Object.fromEntries(context.url.searchParams),
  );
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  return json(await listBoardPublicationsPaged(parsed.data));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'publicaciones', 'create', { json: true });
  const body = await readJson(context.request, boardPublicationInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await createBoardPublication(body.data, actorFrom(context)), 201);
};
