import type { APIRoute } from 'astro';
import { requireResource } from '@/lib/auth/session';
import { actorFrom, fromResult, json, readJson } from '@/lib/api/respond';
import { bulkJobCreateSchema } from '@/lib/validations/certificate';
import { paginationSchema } from '@/lib/validations/common';
import { listJobsPaged } from '@/server/repositories/bulkJobRepository';
import { createBulkJob } from '@/server/services/bulkUploadService';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'view', { json: true });
  const params = paginationSchema.parse(Object.fromEntries(context.url.searchParams));
  const companyRaw = context.url.searchParams.get('companyId');
  const companyId = companyRaw ? Number(companyRaw) : undefined;
  return json(
    await listJobsPaged({
      ...params,
      companyId: Number.isInteger(companyId) ? companyId : undefined,
    }),
  );
};

export const POST: APIRoute = async (context) => {
  await requireResource(context, 'certificados', 'create', { json: true });
  const body = await readJson(context.request, bulkJobCreateSchema);
  if (!body.ok) return body.response;
  return fromResult(await createBulkJob(body.data, actorFrom(context)), 201);
};
