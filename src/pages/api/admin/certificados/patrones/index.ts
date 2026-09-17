import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, json, readJson } from '@/lib/api/respond';
import { filenamePatternInputSchema } from '@/lib/validations/certificate';
import { createPattern, listPatterns } from '@/server/repositories/certificateRepository';
import { recordAudit } from '@/server/services/auditService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'view', { json: true });
  return json(await listPatterns());
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'update', { json: true });
  const body = await readJson(context.request, filenamePatternInputSchema);
  if (!body.ok) return body.response;
  // Validar que la regex compile.
  try {
    new RegExp(body.data.regex);
  } catch {
    return json({ error: 'Datos no válidos', fieldErrors: { regex: 'Expresión regular inválida' } }, 400);
  }
  const pattern = await createPattern(body.data);
  await recordAudit({
    action: 'create',
    module: 'certificados',
    entityType: 'filename_pattern',
    entityId: pattern.id,
    summary: `Creó el patrón de nombre "${pattern.name}"`,
    ...actorFrom(context),
  });
  return json(pattern, 201);
};
