import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import {
  certificateInputSchema,
  certificateListSchema,
} from '@/lib/validations/certificate';
import { listCertificatesPaged } from '@/server/repositories/certificateRepository';
import { createCertificate } from '@/server/services/certificateService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'view', { json: true });
  const parsed = certificateListSchema.safeParse(
    Object.fromEntries(context.url.searchParams),
  );
  if (!parsed.success) return json({ error: 'Parámetros no válidos' }, 400);
  return json(await listCertificatesPaged(parsed.data));
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'create', { json: true });
  const body = await readJson(context.request, certificateInputSchema);
  if (!body.ok) return body.response;
  return fromResult(await createCertificate(body.data, actorFrom(context)), 201);
};
