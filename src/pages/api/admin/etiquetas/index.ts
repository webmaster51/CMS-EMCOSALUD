import type { APIRoute } from 'astro';
import { requireUser } from '@/lib/auth/session';
import { json } from '@/lib/api/respond';
import { listTags } from '@/server/repositories/tagRepository';

export const prerender = false;

/** Lista de etiquetas para el autocompletado del blog. */
export const GET: APIRoute = async (context) => {
  await requireUser(context, { json: true });
  return json(await listTags());
};
