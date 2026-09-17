import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bulkJobItems, bulkJobs, companies, media } from '@/lib/db/schema';
import { mediaUrl } from '@/server/repositories/portalRepository';
import type { BulkItemDTO, BulkJobDTO } from '@/lib/dto/certificate';
import type { Paginated, PaginationParams } from '@/lib/validations/common';

export type CsvRow = { document: string; fullName: string | null; year: number | null };
export type CsvMap = Record<string, CsvRow>;

export async function createJob(input: {
  companyId: number;
  taxYear: number;
  patternId: number | null;
  kind: 'multi_pdf' | 'zip' | 'csv_zip';
  createdBy: string | null;
}): Promise<{ id: string; sourcePrefix: string }> {
  const [row] = await db
    .insert(bulkJobs)
    .values({
      companyId: input.companyId,
      taxYear: input.taxYear,
      patternId: input.patternId,
      kind: input.kind,
      status: 'queued',
      createdBy: input.createdBy,
    })
    .returning({ id: bulkJobs.id });
  const id = row!.id;
  const sourcePrefix = `bulk/${id}`;
  await db.update(bulkJobs).set({ sourcePrefix }).where(eq(bulkJobs.id, id));
  return { id, sourcePrefix };
}

export async function getJob(id: string) {
  const [row] = await db.select().from(bulkJobs).where(eq(bulkJobs.id, id)).limit(1);
  return row;
}

export async function getJobDTO(id: string): Promise<BulkJobDTO | undefined> {
  const [row] = await db
    .select({
      job: bulkJobs,
      companyName: companies.name,
      reportKey: media.storageKey,
    })
    .from(bulkJobs)
    .leftJoin(companies, eq(companies.id, bulkJobs.companyId))
    .leftJoin(media, eq(media.id, bulkJobs.errorReportMediaId))
    .where(eq(bulkJobs.id, id))
    .limit(1);
  if (!row) return undefined;
  const j = row.job;
  return {
    id: j.id,
    kind: j.kind,
    companyName: row.companyName ?? '—',
    taxYear: j.taxYear,
    status: j.status,
    total: j.total,
    processed: j.processed,
    succeeded: j.succeeded,
    failed: j.failed,
    errorReportUrl: row.reportKey ? mediaUrl(null, row.reportKey) : null,
    createdBy: j.createdBy,
    createdAt: j.createdAt.toISOString(),
    startedAt: j.startedAt ? j.startedAt.toISOString() : null,
    finishedAt: j.finishedAt ? j.finishedAt.toISOString() : null,
  };
}

export async function listJobsPaged(
  params: PaginationParams & { companyId?: number },
): Promise<Paginated<BulkJobDTO>> {
  const where = params.companyId ? eq(bulkJobs.companyId, params.companyId) : undefined;
  const offset = (params.page - 1) * params.limit;
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({ id: bulkJobs.id })
      .from(bulkJobs)
      .where(where)
      .orderBy(desc(bulkJobs.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(bulkJobs).where(where),
  ]);
  const data = (await Promise.all(rows.map((r) => getJobDTO(r.id)))).filter(
    (x): x is BulkJobDTO => Boolean(x),
  );
  const total = totalRow?.n ?? 0;
  return {
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function setCsvMap(jobId: string, map: CsvMap): Promise<void> {
  await db.update(bulkJobs).set({ csvMap: map }).where(eq(bulkJobs.id, jobId));
}

export async function addItems(
  jobId: string,
  items: {
    sourceFilename: string;
    storageKey: string;
    sizeBytes: number;
    detectedDocument: string | null;
    detectedYear: number | null;
    fullName: string | null;
  }[],
): Promise<number> {
  if (items.length === 0) return 0;
  await db.insert(bulkJobItems).values(items.map((i) => ({ ...i, bulkJobId: jobId })));
  await db
    .update(bulkJobs)
    .set({ total: sql`${bulkJobs.total} + ${items.length}` })
    .where(eq(bulkJobs.id, jobId));
  return items.length;
}

export async function setJobStatus(
  id: string,
  status: BulkJobDTO['status'],
  patch: Partial<{ startedAt: Date; finishedAt: Date; errorReportMediaId: string }> = {},
): Promise<void> {
  await db.update(bulkJobs).set({ status, ...patch }).where(eq(bulkJobs.id, id));
}

export async function nextPendingBatch(jobId: string, limit: number) {
  return db
    .select()
    .from(bulkJobItems)
    .where(and(eq(bulkJobItems.bulkJobId, jobId), eq(bulkJobItems.status, 'pending')))
    .limit(limit);
}

export async function markItem(
  id: number,
  patch: Partial<typeof bulkJobItems.$inferInsert>,
): Promise<void> {
  await db.update(bulkJobItems).set(patch).where(eq(bulkJobItems.id, id));
}

export async function bumpCounters(
  jobId: string,
  d: { processed: number; succeeded: number; failed: number },
): Promise<void> {
  await db
    .update(bulkJobs)
    .set({
      processed: sql`${bulkJobs.processed} + ${d.processed}`,
      succeeded: sql`${bulkJobs.succeeded} + ${d.succeeded}`,
      failed: sql`${bulkJobs.failed} + ${d.failed}`,
    })
    .where(eq(bulkJobs.id, jobId));
}

export async function countByStatus(jobId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: bulkJobItems.status, n: count() })
    .from(bulkJobItems)
    .where(eq(bulkJobItems.bulkJobId, jobId))
    .groupBy(bulkJobItems.status);
  const out: Record<string, number> = { pending: 0, ok: 0, error: 0, skipped: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function listItems(
  jobId: string,
  params: PaginationParams & { status?: 'pending' | 'ok' | 'error' | 'skipped' },
): Promise<Paginated<BulkItemDTO>> {
  const where = params.status
    ? and(eq(bulkJobItems.bulkJobId, jobId), eq(bulkJobItems.status, params.status))
    : eq(bulkJobItems.bulkJobId, jobId);
  const offset = (params.page - 1) * params.limit;
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: bulkJobItems.id,
        sourceFilename: bulkJobItems.sourceFilename,
        detectedDocument: bulkJobItems.detectedDocument,
        detectedYear: bulkJobItems.detectedYear,
        status: bulkJobItems.status,
        errorMessage: bulkJobItems.errorMessage,
      })
      .from(bulkJobItems)
      .where(where)
      .orderBy(desc(bulkJobItems.id))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(bulkJobItems).where(where),
  ]);
  const total = totalRow?.n ?? 0;
  return {
    data: rows,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function allErrorItems(jobId: string) {
  return db
    .select({
      sourceFilename: bulkJobItems.sourceFilename,
      detectedDocument: bulkJobItems.detectedDocument,
      detectedYear: bulkJobItems.detectedYear,
      errorMessage: bulkJobItems.errorMessage,
    })
    .from(bulkJobItems)
    .where(and(eq(bulkJobItems.bulkJobId, jobId), eq(bulkJobItems.status, 'error')));
}

/** Jobs atascados en 'processing' con items pendientes (para reanudar tras un reinicio). */
export async function stuckJobIds(): Promise<string[]> {
  const rows = await db
    .select({ id: bulkJobs.id })
    .from(bulkJobs)
    .where(eq(bulkJobs.status, 'processing'));
  return rows.map((r) => r.id);
}
