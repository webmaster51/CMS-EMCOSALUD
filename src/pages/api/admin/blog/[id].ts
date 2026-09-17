import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { blogInputSchema } from '@/lib/validations/blog';
import { getBlogPost } from '@/server/repositories/blogRepository';
import { deleteBlogPost, updateBlogPost } from '@/server/services/blogService';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'blog', 'view', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  const dto = await getBlogPost(id);
  return dto ? json(dto) : json({ error: 'No encontrado' }, 404);
};

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'blog', 'update', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  const body = await readJson(context.request, blogInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await updateBlogPost(id, body.data, actorFrom(context)));
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'blog', 'delete', { json: true });
  const id = context.params.id ?? '';
  if (!UUID.test(id)) return json({ error: 'ID no válido' }, 400);
  return fromResult(await deleteBlogPost(id, actorFrom(context)));
};
