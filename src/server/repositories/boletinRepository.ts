import { and, count, desc, eq, gte, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db/client';
import {
  boletinPortals,
  boletines,
  categories,
  media,
  portals,
  users,
} from '@/lib/db/schema';
import { mediaUrl } from '@/server/repositories/portalRepository';
import {
  portalVisibilityCondition,
  syncContentPortals,
} from '@/server/repositories/portalsSync';
import type { BoletinDTO, BoletinPortalRef } from '@/lib/dto/boletin';
import type { BoletinInput } from '@/lib/validations/boletin';
import type { Paginated, PaginationParams } from '@/lib/validations/common';

const pdfM = alias(media, 'pdf_m');
const coverM = alias(media, 'cover_m');

interface ListParams extends PaginationParams {
  status?: 'draft' | 'published' | 'archived';
  categoryId?: number;
  portalId?: number;
  since?: Date;
}

const baseColumns = {
  boletin: boletines,
  categoryName: categories.name,
  pdfKey: pdfM.storageKey,
  coverThumb: coverM.thumbnailKey,
  coverKey: coverM.storageKey,
  authorName: users.name,
};

function rowToDTO(
  r: {
    boletin: typeof boletines.$inferSelect;
    categoryName: string | null;
    pdfKey: string | null;
    coverThumb: string | null;
    coverKey: string | null;
    authorName: string | null;
  },
  portalRefs: BoletinPortalRef[],
): BoletinDTO {
  const b = r.boletin;
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    status: b.status,
    publishedDate: b.publishedDate ? b.publishedDate.toISOString() : null,
    distributionType: b.distributionType,
    portals: portalRefs,
    categoryId: b.categoryId,
    categoryName: r.categoryName,
    pdfMediaId: b.pdfMediaId,
    pdfUrl: r.pdfKey ? mediaUrl(null, r.pdfKey) : null,
    coverMediaId: b.coverMediaId,
    coverUrl: mediaUrl(r.coverThumb, r.coverKey),
    authorName: r.authorName,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

async function portalRefsFor(boletinIds: number[]): Promise<Map<number, BoletinPortalRef[]>> {
  const map = new Map<number, BoletinPortalRef[]>();
  if (boletinIds.length === 0) return map;
  const rows = await db
    .select({
      boletinId: boletinPortals.boletinId,
      id: portals.id,
      name: portals.name,
      slug: portals.slug,
    })
    .from(boletinPortals)
    .innerJoin(portals, eq(portals.id, boletinPortals.portalId))
    .where(inArray(boletinPortals.boletinId, boletinIds));
  for (const row of rows) {
    const list = map.get(row.boletinId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    map.set(row.boletinId, list);
  }
  return map;
}

export async function listBoletinesPaged(
  params: ListParams,
): Promise<Paginated<BoletinDTO>> {
  const filters: SQL[] = [isNull(boletines.deletedAt)];
  if (params.status) filters.push(eq(boletines.status, params.status));
  if (params.categoryId) filters.push(eq(boletines.categoryId, params.categoryId));
  if (params.since) filters.push(gte(boletines.publishedDate, params.since));
  if (params.q) {
    const like = or(
      ilike(boletines.title, `%${params.q}%`),
      ilike(boletines.description, `%${params.q}%`),
    );
    if (like) filters.push(like);
  }
  if (params.portalId) {
    filters.push(
      portalVisibilityCondition(
        boletines.distributionType,
        boletines.id,
        boletinPortals,
        boletinPortals.boletinId,
        boletinPortals.portalId,
        params.portalId,
      ),
    );
  }
  const where = and(...filters);
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(baseColumns)
      .from(boletines)
      .leftJoin(categories, eq(categories.id, boletines.categoryId))
      .leftJoin(pdfM, eq(pdfM.id, boletines.pdfMediaId))
      .leftJoin(coverM, eq(coverM.id, boletines.coverMediaId))
      .leftJoin(users, eq(users.id, boletines.authorId))
      .where(where)
      .orderBy(desc(boletines.publishedDate), desc(boletines.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(boletines).where(where),
  ]);

  const refs = await portalRefsFor(rows.map((r) => r.boletin.id));
  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) => rowToDTO(r, refs.get(r.boletin.id) ?? [])),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getBoletin(id: number): Promise<BoletinDTO | undefined> {
  const [row] = await db
    .select(baseColumns)
    .from(boletines)
    .leftJoin(categories, eq(categories.id, boletines.categoryId))
    .leftJoin(pdfM, eq(pdfM.id, boletines.pdfMediaId))
    .leftJoin(coverM, eq(coverM.id, boletines.coverMediaId))
    .leftJoin(users, eq(users.id, boletines.authorId))
    .where(and(eq(boletines.id, id), isNull(boletines.deletedAt)))
    .limit(1);
  if (!row) return undefined;
  const refs = await portalRefsFor([id]);
  return rowToDTO(row, refs.get(id) ?? []);
}

export async function getBoletinRow(id: number) {
  const [row] = await db
    .select()
    .from(boletines)
    .where(and(eq(boletines.id, id), isNull(boletines.deletedAt)))
    .limit(1);
  return row;
}

function toColumns(input: BoletinInput, authorId: string | null) {
  return {
    title: input.title,
    description: input.description ? input.description : null,
    pdfMediaId: input.pdfMediaId ?? null,
    coverMediaId: input.coverMediaId ?? null,
    categoryId: input.categoryId ?? null,
    publishedDate: input.publishedDate ? new Date(input.publishedDate) : null,
    status: input.status,
    distributionType: input.distributionType,
    authorId,
  };
}

export async function createBoletin(
  input: BoletinInput,
  portalIds: number[],
  authorId: string | null,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(boletines)
      .values(toColumns(input, authorId))
      .returning({ id: boletines.id });
    const id = row!.id;
    await syncContentPortals(
      tx,
      boletinPortals,
      boletinPortals.boletinId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ boletinId: id, portalId }),
    );
    return id;
  });
}

export async function updateBoletin(
  id: number,
  input: BoletinInput,
  portalIds: number[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(boletines)
      .set({
        title: input.title,
        description: input.description ? input.description : null,
        pdfMediaId: input.pdfMediaId ?? null,
        coverMediaId: input.coverMediaId ?? null,
        categoryId: input.categoryId ?? null,
        publishedDate: input.publishedDate ? new Date(input.publishedDate) : null,
        status: input.status,
        distributionType: input.distributionType,
        updatedAt: new Date(),
      })
      .where(eq(boletines.id, id));
    await syncContentPortals(
      tx,
      boletinPortals,
      boletinPortals.boletinId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ boletinId: id, portalId }),
    );
  });
}

export async function softDeleteBoletin(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Limpiamos las relaciones de portales para que no queden huérfanas
    await tx
      .delete(boletinPortals)
      .where(eq(boletinPortals.boletinId, id));

    // 2. Marcamos el boletín como borrado lógico
    await tx
      .update(boletines)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(boletines.id, id));
  });
}

/* ---- Lectura pública (resolución multiportal, plan §5.3 — se expone en Fase 14) ---- */

export async function listPublishedBoletinesForPortal(
  portalSlug: string,
  page = 1,
  limit = 20,
): Promise<Paginated<BoletinDTO>> {
  const [portal] = await db
    .select({ id: portals.id })
    .from(portals)
    .where(and(eq(portals.slug, portalSlug), eq(portals.status, 'active')))
    .limit(1);
  if (!portal) {
    return { data: [], meta: { page, limit, total: 0, totalPages: 1 } };
  }
  return listBoletinesPaged({ page, limit, status: 'published', portalId: portal.id });
}
