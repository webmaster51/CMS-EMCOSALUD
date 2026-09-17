import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, intParam, json, readJson } from '@/lib/api/respond';
import { certificateInputSchema } from '@/lib/validations/certificate';
import { getCertificate } from '@/server/repositories/certificateRepository';
import { deleteCertificate, updateCertificate } from '@/server/services/certificateService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'view', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);

  const dto = await getCertificate(id);
  return dto ? json(dto) : json({ error: 'No encontrado' }, 404);
};

export const PATCH: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'update', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);

  // Valida el payload recibido (asegúrate de que certificateInputSchema incluya fullName y description)
  const body = await readJson(context.request, certificateInputSchema);
  if (!body.ok) return body.response;

  return fromResult(await updateCertificate(id, body.data, actorFrom(context)));
};

export const DELETE: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'delete', { json: true });
  const id = intParam(context.params.id);
  if (!id) return json({ error: 'ID no válido' }, 400);

  return fromResult(await deleteCertificate(id, actorFrom(context)));
};