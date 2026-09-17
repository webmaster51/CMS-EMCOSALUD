import { randomUUID } from 'node:crypto';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { putObject, readObject } from '@/lib/storage/s3';
import { validateUpload } from '@/lib/storage/media-file';
import { db } from '@/lib/db/client';
import { media } from '@/lib/db/schema';
import {
  orderPatterns,
  parseCertificateFilename,
  type FilenamePattern,
} from '@/lib/certificates/filename-parser';
import { normalizeFilename, parsePlanilla } from '@/lib/certificates/csv-parser';
import { extractZip } from '@/lib/certificates/unzip';
import { recordAudit } from '@/server/services/auditService';
import { removeMedia } from '@/server/services/certificateService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import * as jobs from '@/server/repositories/bulkJobRepository';
import * as certRepo from '@/server/repositories/certificateRepository';
import type { BulkJobCreate } from '@/lib/validations/certificate';
import type { CsvMap } from '@/server/repositories/bulkJobRepository';

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

const BATCH = 100;

export async function createBulkJob(
  input: BulkJobCreate,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const { id } = await jobs.createJob({
    companyId: input.companyId,
    taxYear: input.taxYear,
    patternId: input.patternId ?? null,
    kind: input.kind,
    createdBy: actor.userId || null,
  });
  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'certificados',
    entityType: 'bulk_job',
    entityId: id,
    summary: `Inició una carga masiva de certificados (${input.kind}, año ${input.taxYear})`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done({ id });
}

async function loadPatterns(jobPatternId: number | null): Promise<FilenamePattern[]> {
  const all = await certRepo.listPatterns(true);
  return orderPatterns(
    all.map((p) => ({
      id: p.id,
      regex: p.regex,
      documentGroup: p.documentGroup,
      nameGroup: p.nameGroup ?? null,
      yearGroup: p.yearGroup ?? null,
    })),
    jobPatternId,
  );
}

/** Sube un lote de archivos individuales (modo multi_pdf). */
export async function addFiles(
  jobId: string,
  files: { name: string; bytes: Buffer }[],
): Promise<ServiceResult<{ added: number }>> {
  const job = await jobs.getJob(jobId);
  if (!job) return fail(404, 'Carga no encontrada');
  if (job.status !== 'queued') return fail(409, 'La carga ya no admite más archivos');

  const patterns = await loadPatterns(job.patternId);
  const csvMap = (job.csvMap as CsvMap | null) ?? {};
  const items = await Promise.all(
    files.map((f) => storeAndDescribe(job.id, f.name, f.bytes, patterns, job.taxYear, csvMap)),
  );
  const added = await jobs.addItems(jobId, items);
  return done({ added });
}

/** Sube y descompone un ZIP de PDFs (modos zip / csv_zip). */
export async function addZip(
  jobId: string,
  zipBytes: Buffer,
): Promise<ServiceResult<{ added: number }>> {
  const job = await jobs.getJob(jobId);
  if (!job) return fail(404, 'Carga no encontrada');
  if (job.status !== 'queued') return fail(409, 'La carga ya no admite más archivos');

  let entries;
  try {
    entries = await extractZip(zipBytes, (name) => /\.pdf$/i.test(name));
  } catch {
    return fail(422, 'No se pudo leer el ZIP');
  }
  if (entries.length === 0) return fail(422, 'El ZIP no contiene PDFs');

  const patterns = await loadPatterns(job.patternId);
  const csvMap = (job.csvMap as CsvMap | null) ?? {};
  const items = await Promise.all(
    entries.map((e) =>
      storeAndDescribe(job.id, e.filename, e.buffer, patterns, job.taxYear, csvMap),
    ),
  );
  const added = await jobs.addItems(jobId, items);
  return done({ added });
}

/** Guarda la planilla CSV/Excel para el matching (modo csv_zip). */
export async function attachPlanilla(
  jobId: string,
  filename: string,
  bytes: Buffer,
): Promise<ServiceResult<{ rows: number }>> {
  const job = await jobs.getJob(jobId);
  if (!job) return fail(404, 'Carga no encontrada');
  const map = await parsePlanilla(filename, bytes);
  const rows = Object.keys(map).length;
  if (rows === 0) return fail(422, 'La planilla no tiene filas reconocibles (documento/archivo)');
  await jobs.setCsvMap(jobId, map);
  return done({ rows });
}

async function storeAndDescribe(
  jobId: string,
  originalName: string,
  bytes: Buffer,
  patterns: FilenamePattern[],
  fallbackYear: number,
  csvMap: CsvMap,
): Promise<{
  sourceFilename: string;
  storageKey: string;
  sizeBytes: number;
  detectedDocument: string | null;
  detectedYear: number | null;
  fullName: string | null;
}> {
  const base = originalName.replace(/^.*[/\\]/, '');
  const storageKey = `bulk/${jobId}/${randomUUID()}.pdf`;
  await putObject(storageKey, bytes, 'application/pdf');

  const csv = csvMap[normalizeFilename(base)];
  if (csv) {
    return {
      sourceFilename: base,
      storageKey,
      sizeBytes: bytes.length,
      detectedDocument: csv.document,
      detectedYear: csv.year ?? fallbackYear,
      fullName: csv.fullName,
    };
  }
  const parsed = parseCertificateFilename(base, patterns, fallbackYear);
  return {
    sourceFilename: base,
    storageKey,
    sizeBytes: bytes.length,
    detectedDocument: parsed.document,
    detectedYear: parsed.year,
    fullName: parsed.fullName,
  };
}

export async function startJob(
  jobId: string,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const job = await jobs.getJob(jobId);
  if (!job) return fail(404, 'Carga no encontrada');
  if (job.status !== 'queued') return fail(409, 'La carga ya se está procesando o terminó');
  if (job.total === 0) return fail(422, 'No hay archivos para procesar');

  await jobs.setJobStatus(jobId, 'processing', { startedAt: new Date() });
  await recordAudit({
    userId: actor.userId,
    action: 'process',
    module: 'certificados',
    entityType: 'bulk_job',
    entityId: jobId,
    summary: `Procesó una carga masiva de ${job.total} certificados`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  void runWorker(jobId);
  return done({ id: jobId });
}

/** Bucle de procesamiento por lotes. Un archivo que falla no detiene la carga. */
export async function runWorker(jobId: string): Promise<void> {
  const job = await jobs.getJob(jobId);
  if (!job) return;

  const patterns = await loadPatterns(job.patternId);
  try {
    for (;;) {
      const batch = await jobs.nextPendingBatch(jobId, BATCH);
      if (batch.length === 0) break;

      let succeeded = 0;
      let failed = 0;
      for (const item of batch) {
        const ok = await processItem(job, item, patterns);
        if (ok) succeeded++;
        else failed++;
      }
      await jobs.bumpCounters(jobId, { processed: batch.length, succeeded, failed });
    }
  } catch (err) {
    logger.error({ err, jobId }, 'fallo del worker de carga masiva');
  }

  const counts = await jobs.countByStatus(jobId);
  const status =
    counts.error && counts.error > 0
      ? counts.ok && counts.ok > 0
        ? 'completed_with_errors'
        : 'failed'
      : 'completed';
  await jobs.setJobStatus(jobId, status, { finishedAt: new Date() });

  if (counts.error && counts.error > 0) {
    await buildErrorReport(jobId);
  }
  logger.info({ jobId, ...counts }, 'carga masiva finalizada');
}

type JobRow = NonNullable<Awaited<ReturnType<typeof jobs.getJob>>>;
type ItemRow = Awaited<ReturnType<typeof jobs.nextPendingBatch>>[number];

async function processItem(
  job: JobRow,
  item: ItemRow,
  patterns: FilenamePattern[],
): Promise<boolean> {
  try {
    let document = item.detectedDocument;
    let year = item.detectedYear;
    let fullName = item.fullName;

    if (!document || !fullName) {
      const parsed = parseCertificateFilename(item.sourceFilename, patterns, job.taxYear);
      document = document ?? parsed.document;
      year = year ?? parsed.year;
      fullName = fullName ?? parsed.fullName;
    }
    if (!document) throw new Error('No se pudo detectar el documento en el nombre del archivo');
    year = year ?? job.taxYear;

    const bytes = await readObject(item.storageKey);
    if (!bytes) throw new Error('El archivo no se encontró en el almacenamiento');

    const validation = await validateUpload(bytes, 'application/pdf', getEnv().MAX_FILE_SIZE);
    if (!validation.ok) throw new Error('El archivo no es un PDF válido');

    const [mediaRow] = await db
      .insert(media)
      .values({
        filename: item.storageKey.split('/').pop()!,
        originalName: item.sourceFilename,
        mimeType: 'application/pdf',
        sizeBytes: item.sizeBytes,
        storageKey: item.storageKey,
        kind: 'document',
        uploadedBy: job.createdBy,
      })
      .returning({ id: media.id });

    // Usa item.sourceFilename en lugar de originalFilename
    const finalFullName = fullName || item.sourceFilename || null;

    const upsert = await certRepo.upsertCertificate({
      companyId: job.companyId,
      taxYear: year,
      documentNumber: document,
      fullName: finalFullName,
      pdfMediaId: mediaRow!.id,
      createdBy: job.createdBy,
    });
    if (upsert.replacedMediaId) await removeMedia(upsert.replacedMediaId);

    await jobs.markItem(item.id, {
      status: 'ok',
      detectedDocument: document,
      detectedYear: year,
      mediaId: mediaRow!.id,
      certificateId: upsert.id,
      errorMessage: null,
    });
    return true;
  } catch (err) {
    await jobs.markItem(item.id, {
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Error desconocido',
    });
    return false;
  }
}

async function buildErrorReport(jobId: string): Promise<void> {
  const rows = await jobs.allErrorItems(jobId);
  const header = 'archivo,documento_detectado,anio_detectado,error\n';
  const body = rows
    .map((r) =>
      [
        r.sourceFilename,
        r.detectedDocument ?? '',
        r.detectedYear ?? '',
        (r.errorMessage ?? '').replace(/[\r\n,]/g, ' '),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
  const csv = Buffer.from(header + body, 'utf8');
  const key = `bulk/${jobId}/errores.csv`;
  await putObject(key, csv, 'text/csv');
  const [mediaRow] = await db
    .insert(media)
    .values({
      filename: 'errores.csv',
      originalName: `errores-carga-${jobId}.csv`,
      mimeType: 'text/csv',
      sizeBytes: csv.length,
      storageKey: key,
      kind: 'document',
    })
    .returning({ id: media.id });
  await jobs.setJobStatus(jobId, (await jobs.getJob(jobId))!.status, {
    errorReportMediaId: mediaRow!.id,
  });
}

/** Reanuda cargas que quedaron a medias tras un reinicio del servidor. */
export async function resumeStuckJobs(): Promise<void> {
  const ids = await jobs.stuckJobIds();
  for (const id of ids) {
    logger.info({ jobId: id }, 'reanudando carga masiva atascada');
    void runWorker(id);
  }
}