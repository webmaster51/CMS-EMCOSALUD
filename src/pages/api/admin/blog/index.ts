import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { blogInputSchema, blogListSchema } from '@/lib/validations/blog';
import { listBlogPaged } from '@/server/repositories/blogRepository';
import { createBlogPost } from '@/server/services/blogService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'blog', 'view', { json: true });
  const parsed = blogListSchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  return json(await listBlogPaged(parsed.data));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'blog', 'create', { json: true });
  const body = await readJson(context.request, blogInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await createBlogPost(body.data, actorFrom(context)), 201);
};
