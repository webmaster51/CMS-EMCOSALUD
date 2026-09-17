import { and, asc, count, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  certificateFilenamePatterns,
  certificates,
  companies,
  media,
} from '@/lib/db/schema';
import { mediaUrl } from '@/server/repositories/portalRepository';
import type {
  CertificateDTO,
  FilenamePatternDTO,
} from '@/lib/dto/certificate';
import type { CertificateInput, FilenamePatternInput } from '@/lib/validations/certificate';
import type { Paginated, PaginationParams } from '@/lib/validations/common';

interface ListParams extends PaginationParams {
  companyId?: number;
  taxYear?: number;
  document?: string;
  status?: 'active' | 'inactive';
}

function toDTO(row: {
  cert: typeof certificates.$inferSelect;
  companyName: string | null;
  pdfKey: string | null;
  pdfOriginalName?: string | null;
}): CertificateDTO {
  const c = row.cert;
  return {
    id: c.id,
    companyId: c.companyId,
    companyName: row.companyName ?? '—',
    taxYear: c.taxYear,
    documentNumber: c.documentNumber,
    fullName: c.fullName ?? null,
    description: c.description ?? null,
    pdfMediaId: c.pdfMediaId,
    pdfUrl: row.pdfKey ? mediaUrl(null, row.pdfKey) : null,
    pdfName: row.pdfOriginalName ?? null,
    status: c.status as 'active' | 'inactive',
    issuedDate: c.issuedDate ? c.issuedDate.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function listCertificatesPaged(
  params: ListParams,
): Promise<Paginated<CertificateDTO>> {
  const filters = [];
  if (params.companyId) filters.push(eq(certificates.companyId, params.companyId));
  if (params.taxYear) filters.push(eq(certificates.taxYear, params.taxYear));
  if (params.status) filters.push(eq(certificates.status, params.status));
  if (params.document)
    filters.push(ilike(certificates.documentNumber, `%${params.document}%`));
  if (params.q)
    filters.push(
      sql`(${certificates.documentNumber} ILIKE ${'%' + params.q + '%'} OR ${certificates.fullName} ILIKE ${'%' + params.q + '%'})`,
    );
  const where = filters.length ? and(...filters) : undefined;
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        cert: certificates,
        companyName: companies.name,
        pdfKey: media.storageKey,
        pdfOriginalName: media.filename,
      })
      .from(certificates)
      .leftJoin(companies, eq(companies.id, certificates.companyId))
      .leftJoin(media, eq(media.id, certificates.pdfMediaId))
      .where(where)
      .orderBy(desc(certificates.taxYear), asc(certificates.documentNumber))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(certificates).where(where),
  ]);

  const total = totalRow?.n ?? 0;
  return {
    data: rows.map(toDTO),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getCertificate(id: number): Promise<CertificateDTO | undefined> {
  const [row] = await db
    .select({
      cert: certificates,
      companyName: companies.name,
      pdfKey: media.storageKey,
      pdfOriginalName: media.filename,
    })
    .from(certificates)
    .leftJoin(companies, eq(companies.id, certificates.companyId))
    .leftJoin(media, eq(media.id, certificates.pdfMediaId))
    .where(eq(certificates.id, id))
    .limit(1);
  return row ? toDTO(row) : undefined;
}

export async function getCertificateRow(id: number) {
  const [row] = await db.select().from(certificates).where(eq(certificates.id, id)).limit(1);
  return row;
}

export async function createCertificate(
  input: CertificateInput,
  createdBy: string | null,
) {
  const [row] = await db
    .insert(certificates)
    .values({
      companyId: input.companyId,
      taxYear: input.taxYear,
      documentNumber: input.documentNumber,
      fullName: input.fullName ?? null,
      description: input.description ?? null,
      pdfMediaId: input.pdfMediaId,
      status: input.status,
      issuedDate: input.issuedDate ? new Date(input.issuedDate) : null,
      createdBy,
    })
    .returning();
  return row!;
}

export async function updateCertificate(id: number, input: CertificateInput) {
  const [row] = await db
    .update(certificates)
    .set({
      companyId: input.companyId,
      taxYear: input.taxYear,
      documentNumber: input.documentNumber,
      fullName: input.fullName ?? null,
      description: input.description ?? null,
      pdfMediaId: input.pdfMediaId,
      status: input.status,
      issuedDate: input.issuedDate ? new Date(input.issuedDate) : null,
      updatedAt: new Date(),
    })
    .where(eq(certificates.id, id))
    .returning();
  return row;
}

export async function deleteCertificate(id: number) {
  await db.delete(certificates).where(eq(certificates.id, id));
}

export async function keyExists(
  companyId: number,
  taxYear: number,
  documentNumber: string,
  exceptId?: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: certificates.id })
    .from(certificates)
    .where(
      and(
        eq(certificates.companyId, companyId),
        eq(certificates.taxYear, taxYear),
        eq(certificates.documentNumber, documentNumber),
      ),
    )
    .limit(1);
  return Boolean(row) && row!.id !== exceptId;
}

/**
 * Inserta o actualiza un certificado por (empresa, año, documento).
 * Guarda fullName y description provenientes del Job masivo.
 */
export async function upsertCertificate(input: {
  companyId: number;
  taxYear: number;
  documentNumber: string;
  fullName: string | null;
  description?: string | null;
  pdfMediaId: string;
  createdBy: string | null;
}): Promise<{ id: number; replacedMediaId: string | null; created: boolean }> {
  const [existing] = await db
    .select({ id: certificates.id, pdfMediaId: certificates.pdfMediaId })
    .from(certificates)
    .where(
      and(
        eq(certificates.companyId, input.companyId),
        eq(certificates.taxYear, input.taxYear),
        eq(certificates.documentNumber, input.documentNumber),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(certificates)
      .set({
        ...(input.fullName ? { fullName: input.fullName } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        pdfMediaId: input.pdfMediaId,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(certificates.id, existing.id));
    return {
      id: existing.id,
      replacedMediaId:
        existing.pdfMediaId !== input.pdfMediaId ? existing.pdfMediaId : null,
      created: false,
    };
  }

  const [row] = await db
    .insert(certificates)
    .values({
      companyId: input.companyId,
      taxYear: input.taxYear,
      documentNumber: input.documentNumber,
      fullName: input.fullName ?? null,
      description: input.description ?? null,
      pdfMediaId: input.pdfMediaId,
      status: 'active',
      createdBy: input.createdBy,
    })
    .returning({ id: certificates.id });
  return { id: row!.id, replacedMediaId: null, created: true };
}

export async function distinctTaxYears(companyId?: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ year: certificates.taxYear })
    .from(certificates)
    .where(companyId ? eq(certificates.companyId, companyId) : undefined)
    .orderBy(desc(certificates.taxYear));
  return rows.map((r) => r.year);
}

/* ---- Patrones de nombre ---- */

function patternToDTO(row: typeof certificateFilenamePatterns.$inferSelect): FilenamePatternDTO {
  return {
    id: row.id,
    name: row.name,
    regex: row.regex,
    documentGroup: row.documentGroup,
    nameGroup: row.nameGroup ?? null,
    yearGroup: row.yearGroup ?? null,
    isDefault: row.isDefault,
    enabled: row.enabled,
  };
}

export async function listPatterns(onlyEnabled = false): Promise<FilenamePatternDTO[]> {
  const rows = await db
    .select()
    .from(certificateFilenamePatterns)
    .orderBy(desc(certificateFilenamePatterns.isDefault), asc(certificateFilenamePatterns.id));
  return (onlyEnabled ? rows.filter((r) => r.enabled) : rows).map(patternToDTO);
}

export async function createPattern(input: FilenamePatternInput): Promise<FilenamePatternDTO> {
  const [row] = await db
    .insert(certificateFilenamePatterns)
    .values({
      name: input.name,
      regex: input.regex,
      documentGroup: input.documentGroup,
      nameGroup: input.nameGroup ? input.nameGroup : null,
      yearGroup: input.yearGroup ? input.yearGroup : null,
      enabled: input.enabled,
    })
    .returning();
  return patternToDTO(row!);
}

export async function setPatternEnabled(id: number, enabled: boolean): Promise<void> {
  await db
    .update(certificateFilenamePatterns)
    .set({ enabled })
    .where(eq(certificateFilenamePatterns.id, id));
}

export async function deletePattern(id: number): Promise<void> {
  await db
    .delete(certificateFilenamePatterns)
    .where(and(eq(certificateFilenamePatterns.id, id), eq(certificateFilenamePatterns.isDefault, false)));
}