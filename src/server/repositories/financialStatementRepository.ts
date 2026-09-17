import { and, asc, count, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  companies,
  financialStatementFiles,
  financialStatementPortals,
  financialStatements,
  media,
  portals,
  users,
} from '@/lib/db/schema';
import { mediaUrl } from '@/server/repositories/portalRepository';
import {
  portalVisibilityCondition,
  syncContentPortals,
} from '@/server/repositories/portalsSync';
import type {
  FinancialStatementDTO,
  FinancialStatementFileDTO,
  PortalRef,
  PublicFinancialStatement,
} from '@/lib/dto/financialStatement';
import type { FinancialStatementInput } from '@/lib/validations/financialStatement';
import type { ApiList } from '@/lib/dto/public';
import type { Paginated, PaginationParams } from '@/lib/validations/common';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface ListParams extends PaginationParams {
  companyId?: number;
  fiscalYear?: number;
  status?: FinancialStatementDTO['status'];
  portalId?: number;
}

const baseColumns = {
  fs: financialStatements,
  companyName: companies.name,
  authorName: users.name,
};

type BaseRow = {
  fs: typeof financialStatements.$inferSelect;
  companyName: string | null;
  authorName: string | null;
};

async function auxFor(ids: number[]) {
  const portalMap = new Map<number, PortalRef[]>();
  const fileMap = new Map<number, FinancialStatementFileDTO[]>();
  if (ids.length === 0) return { portals: portalMap, files: fileMap };
  const [portalRows, fileRows] = await Promise.all([
    db
      .select({
        fsId: financialStatementPortals.financialStatementId,
        id: portals.id,
        name: portals.name,
        slug: portals.slug,
      })
      .from(financialStatementPortals)
      .innerJoin(portals, eq(portals.id, financialStatementPortals.portalId))
      .where(inArray(financialStatementPortals.financialStatementId, ids)),
    db
      .select({
        fsId: financialStatementFiles.financialStatementId,
        id: financialStatementFiles.id,
        label: financialStatementFiles.label,
        mediaId: financialStatementFiles.mediaId,
        sortOrder: financialStatementFiles.sortOrder,
        thumb: media.thumbnailKey,
        key: media.storageKey,
      })
      .from(financialStatementFiles)
      .leftJoin(media, eq(media.id, financialStatementFiles.mediaId))
      .where(inArray(financialStatementFiles.financialStatementId, ids))
      .orderBy(asc(financialStatementFiles.sortOrder), asc(financialStatementFiles.id)),
  ]);
  for (const row of portalRows) {
    const list = portalMap.get(row.fsId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    portalMap.set(row.fsId, list);
  }
  for (const row of fileRows) {
    const list = fileMap.get(row.fsId) ?? [];
    list.push({
      id: row.id,
      label: row.label,
      mediaId: row.mediaId,
      url: mediaUrl(row.thumb, row.key),
      sortOrder: row.sortOrder,
    });
    fileMap.set(row.fsId, list);
  }
  return { portals: portalMap, files: fileMap };
}

function rowToDTO(
  r: BaseRow,
  portalRefs: PortalRef[],
  files: FinancialStatementFileDTO[],
): FinancialStatementDTO {
  const f = r.fs;
  return {
    id: f.id,
    companyId: f.companyId,
    companyName: r.companyName ?? '—',
    fiscalYear: f.fiscalYear,
    title: f.title,
    summary: f.summary,
    publishedDate: f.publishedDate ? f.publishedDate.toISOString() : null,
    status: f.status,
    distributionType: f.distributionType,
    portals: portalRefs,
    files,
    authorName: r.authorName,
    createdAt: f.createdAt.toISOString(),
  };
}

export async function listPaged(
  params: ListParams,
): Promise<Paginated<FinancialStatementDTO>> {
  const filters: SQL[] = [isNull(financialStatements.deletedAt)];
  if (params.companyId) filters.push(eq(financialStatements.companyId, params.companyId));
  if (params.fiscalYear) filters.push(eq(financialStatements.fiscalYear, params.fiscalYear));
  if (params.status) filters.push(eq(financialStatements.status, params.status));
  if (params.portalId) {
    filters.push(
      portalVisibilityCondition(
        financialStatements.distributionType,
        financialStatements.id,
        financialStatementPortals,
        financialStatementPortals.financialStatementId,
        financialStatementPortals.portalId,
        params.portalId,
      ),
    );
  }
  const where = and(...filters);
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(baseColumns)
      .from(financialStatements)
      .leftJoin(companies, eq(companies.id, financialStatements.companyId))
      .leftJoin(users, eq(users.id, financialStatements.createdBy))
      .where(where)
      .orderBy(desc(financialStatements.fiscalYear), asc(financialStatements.companyId))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(financialStatements).where(where),
  ]);

  const ids = rows.map((r) => r.fs.id);
  const aux = await auxFor(ids);
  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) =>
      rowToDTO(r, aux.portals.get(r.fs.id) ?? [], aux.files.get(r.fs.id) ?? []),
    ),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function get(id: number): Promise<FinancialStatementDTO | undefined> {
  const [row] = await db
    .select(baseColumns)
    .from(financialStatements)
    .leftJoin(companies, eq(companies.id, financialStatements.companyId))
    .leftJoin(users, eq(users.id, financialStatements.createdBy))
    .where(and(eq(financialStatements.id, id), isNull(financialStatements.deletedAt)))
    .limit(1);
  if (!row) return undefined;
  const aux = await auxFor([id]);
  return rowToDTO(row, aux.portals.get(id) ?? [], aux.files.get(id) ?? []);
}

export async function getRow(id: number) {
  const [row] = await db
    .select()
    .from(financialStatements)
    .where(and(eq(financialStatements.id, id), isNull(financialStatements.deletedAt)))
    .limit(1);
  return row;
}

export async function keyExists(
  companyId: number,
  fiscalYear: number,
  exceptId?: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: financialStatements.id })
    .from(financialStatements)
    .where(
      and(
        eq(financialStatements.companyId, companyId),
        eq(financialStatements.fiscalYear, fiscalYear),
        isNull(financialStatements.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(row) && row!.id !== exceptId;
}

/** Devuelve los mediaIds de los documentos (para limpiar el storage al borrar/editar). */
export async function fileMediaIds(id: number): Promise<string[]> {
  const rows = await db
    .select({ mediaId: financialStatementFiles.mediaId })
    .from(financialStatementFiles)
    .where(eq(financialStatementFiles.financialStatementId, id));
  return rows.map((r) => r.mediaId);
}

function columns(input: FinancialStatementInput) {
  return {
    companyId: input.companyId,
    fiscalYear: input.fiscalYear,
    title: input.title ? input.title : null,
    summary: input.summary ? input.summary : null,
    publishedDate: input.publishedDate ? new Date(input.publishedDate) : null,
    status: input.status,
    distributionType: input.distributionType,
  };
}

async function syncFiles(
  tx: Tx,
  fsId: number,
  files: FinancialStatementInput['files'],
): Promise<void> {
  await tx
    .delete(financialStatementFiles)
    .where(eq(financialStatementFiles.financialStatementId, fsId));
  if (files.length === 0) return;
  await tx.insert(financialStatementFiles).values(
    files.map((f, i) => ({
      financialStatementId: fsId,
      label: f.label,
      mediaId: f.mediaId,
      sortOrder: i,
    })),
  );
}

export async function create(
  input: FinancialStatementInput,
  portalIds: number[],
  createdBy: string | null,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(financialStatements)
      .values({ ...columns(input), createdBy })
      .returning({ id: financialStatements.id });
    const id = row!.id;
    await syncContentPortals(
      tx,
      financialStatementPortals,
      financialStatementPortals.financialStatementId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ financialStatementId: id, portalId }),
    );
    await syncFiles(tx, id, input.files);
    return id;
  });
}

export async function update(
  id: number,
  input: FinancialStatementInput,
  portalIds: number[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(financialStatements)
      .set({ ...columns(input), updatedAt: new Date() })
      .where(eq(financialStatements.id, id));
    await syncContentPortals(
      tx,
      financialStatementPortals,
      financialStatementPortals.financialStatementId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ financialStatementId: id, portalId }),
    );
    await syncFiles(tx, id, input.files);
  });
}

export async function softDelete(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Borrar los archivos asociados físicamente
    await tx
      .delete(financialStatementFiles)
      .where(eq(financialStatementFiles.financialStatementId, id));
      
    // 2. Borrar las relaciones con los portales físicamente 👈 (Esto es lo que faltaba)
    await tx
      .delete(financialStatementPortals)
      .where(eq(financialStatementPortals.financialStatementId, id));

    // 3. Marcar el registro principal como borrado lógico
    await tx
      .update(financialStatements)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(financialStatements.id, id));
  });
}

export async function distinctYears(companyId?: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ year: financialStatements.fiscalYear })
    .from(financialStatements)
    .where(
      companyId
        ? and(
            eq(financialStatements.companyId, companyId),
            isNull(financialStatements.deletedAt),
          )
        : isNull(financialStatements.deletedAt),
    )
    .orderBy(desc(financialStatements.fiscalYear));
  return rows.map((r) => r.year);
}

/* ────────────────────────────────────────────────────────────
 * Resolución para los sitios (API pública).
 * ──────────────────────────────────────────────────────────── */

export async function listPublishedFinancialStatementsForPortal(
  portalId: number,
  q: { page: number; limit: number; year?: number },
): Promise<ApiList<PublicFinancialStatement>> {
  const filters: SQL[] = [
    isNull(financialStatements.deletedAt),
    eq(financialStatements.status, 'published'),
    portalVisibilityCondition(
      financialStatements.distributionType,
      financialStatements.id,
      financialStatementPortals,
      financialStatementPortals.financialStatementId,
      financialStatementPortals.portalId,
      portalId,
    ),
  ];
  if (q.year) filters.push(eq(financialStatements.fiscalYear, q.year));
  const where = and(...filters);
  const offset = (q.page - 1) * q.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        fs: financialStatements,
        companyName: companies.name,
        companyShort: companies.shortName,
      })
      .from(financialStatements)
      .leftJoin(companies, eq(companies.id, financialStatements.companyId))
      .where(where)
      .orderBy(desc(financialStatements.fiscalYear), asc(financialStatements.companyId))
      .limit(q.limit)
      .offset(offset),
    db.select({ n: count() }).from(financialStatements).where(where),
  ]);

  const aux = await auxFor(rows.map((r) => r.fs.id));
  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) => ({
      fiscalYear: r.fs.fiscalYear,
      title: r.fs.title,
      summary: r.fs.summary,
      company: { name: r.companyName ?? '—', shortName: r.companyShort ?? '' },
      publishedDate: r.fs.publishedDate ? r.fs.publishedDate.toISOString() : null,
      files: (aux.files.get(r.fs.id) ?? []).map((f) => ({ label: f.label, url: f.url })),
    })),
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    },
  };
}
