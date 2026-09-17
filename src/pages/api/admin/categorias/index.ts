import type { APIRoute } from 'astro';
import { requireUser } from '@/lib/auth/session';
import { actorFrom, json, readJson } from '@/lib/api/respond';
import { categoryInputSchema, categoryListSchema } from '@/lib/validations/category';
import { findOrCreateCategory, listCategories } from '@/server/repositories/categoryRepository';
import { recordAudit } from '@/server/services/auditService';

export const prerender = false;

// Las categorías las gestionan todos los editores (parte de la creación de contenido).

export const GET: APIRoute = async (context) => {
  await requireUser(context, { json: true });
  const parsed = categoryListSchema.safeParse(Object.fromEntries(context.url.searchParams));
  if (!parsed.success) return json({ error: 'Falta el módulo' }, 400);
  return json(await listCategories(parsed.data.module));
};

export const POST: APIRoute = async (context) => {
  await requireUser(context, { json: true });
  const body = await readJson(context.request, categoryInputSchema);
  if (!body.ok) return body.response;

  const category = await findOrCreateCategory(body.data.module, body.data.name);
  await recordAudit({
    action: 'create',
    module: body.data.module,
    entityType: 'category',
    entityId: category.id,
    summary: `Creó la categoría "${category.name}" (${body.data.module})`,
    ...actorFrom(context),
  });
  return json(category, 201);
};
