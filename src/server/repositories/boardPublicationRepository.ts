import { and, count, desc, eq, gte, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db/client';
import {
  boardPublicationPortals,
  boardPublications,
  media,
  portals,
  users,
} from '@/lib/db/schema';
import { mediaUrl } from '@/server/repositories/portalRepository';
import {
  portalVisibilityCondition,
  syncContentPortals,
} from '@/server/repositories/portalsSync';
import type { BoardPublicationDTO, PortalRef } from '@/lib/dto/boardPublication';
import type { BoardPublicationInput } from '@/lib/validations/boardPublication';
import type { Paginated, PaginationParams } from '@/lib/validations/common';

const imgM = alias(media, 'img_m');

interface ListParams extends PaginationParams {
  status?: 'draft' | 'published' | 'archived';
  portalId?: number;
  since?: Date;
}

const baseColumns = {
  pub: boardPublications,
  imgThumb: imgM.thumbnailKey,
  imgKey: imgM.storageKey,
  authorName: users.name,
};

type BaseRow = {
  pub: typeof boardPublications.$inferSelect;
  imgThumb: string | null;
  imgKey: string | null;
  authorName: string | null;
};

function rowToDTO(r: BaseRow, portalRefs: PortalRef[]): BoardPublicationDTO {
  const p = r.pub;
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    status: p.status,
    publishedDate: p.publishedDate ? p.publishedDate.toISOString() : null,
    distributionType: p.distributionType,
    portals: portalRefs,
    imageMediaId: p.imageMediaId,
    imageUrl: mediaUrl(r.imgThumb, r.imgKey),
    authorName: r.authorName,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

async function portalRefsFor(ids: number[]): Promise<Map<number, PortalRef[]>> {
  const map = new Map<number, PortalRef[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      pubId: boardPublicationPortals.boardPublicationId,
      id: portals.id,
      name: portals.name,
      slug: portals.slug,
    })
    .from(boardPublicationPortals)
    .innerJoin(portals, eq(portals.id, boardPublicationPortals.portalId))
    .where(inArray(boardPublicationPortals.boardPublicationId, ids));
  for (const row of rows) {
    const list = map.get(row.pubId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    map.set(row.pubId, list);
  }
  return map;
}

export async function listBoardPublicationsPaged(
  params: ListParams,
): Promise<Paginated<BoardPublicationDTO>> {
  const filters: SQL[] = [isNull(boardPublications.deletedAt)];
  if (params.status) filters.push(eq(boardPublications.status, params.status));
  if (params.since) filters.push(gte(boardPublications.publishedDate, params.since));
  if (params.q) {
    const like = or(
      ilike(boardPublications.title, `%${params.q}%`),
      ilike(boardPublications.description, `%${params.q}%`),
    );
    if (like) filters.push(like);
  }
  if (params.portalId) {
    filters.push(
      portalVisibilityCondition(
        boardPublications.distributionType,
        boardPublications.id,
        boardPublicationPortals,
        boardPublicationPortals.boardPublicationId,
        boardPublicationPortals.portalId,
        params.portalId,
      ),
    );
  }
  const where = and(...filters);
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(baseColumns)
      .from(boardPublications)
      .leftJoin(imgM, eq(imgM.id, boardPublications.imageMediaId))
      .leftJoin(users, eq(users.id, boardPublications.authorId))
      .where(where)
      .orderBy(desc(boardPublications.publishedDate), desc(boardPublications.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(boardPublications).where(where),
  ]);

  const refs = await portalRefsFor(rows.map((r) => r.pub.id));
  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) => rowToDTO(r, refs.get(r.pub.id) ?? [])),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getBoardPublication(
  id: number,
): Promise<BoardPublicationDTO | undefined> {
  const [row] = await db
    .select(baseColumns)
    .from(boardPublications)
    .leftJoin(imgM, eq(imgM.id, boardPublications.imageMediaId))
    .leftJoin(users, eq(users.id, boardPublications.authorId))
    .where(and(eq(boardPublications.id, id), isNull(boardPublications.deletedAt)))
    .limit(1);
  if (!row) return undefined;
  const refs = await portalRefsFor([id]);
  return rowToDTO(row, refs.get(id) ?? []);
}

export async function getBoardPublicationRow(id: number) {
  const [row] = await db
    .select()
    .from(boardPublications)
    .where(and(eq(boardPublications.id, id), isNull(boardPublications.deletedAt)))
    .limit(1);
  return row;
}

function toColumns(input: BoardPublicationInput, authorId: string | null) {
  return {
    title: input.title,
    description: input.description ? input.description : null,
    imageMediaId: input.imageMediaId ?? null,
    publishedDate: input.publishedDate ? new Date(input.publishedDate) : null,
    status: input.status,
    distributionType: input.distributionType,
    authorId,
  };
}

export async function createBoardPublication(
  input: BoardPublicationInput,
  portalIds: number[],
  authorId: string | null,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(boardPublications)
      .values(toColumns(input, authorId))
      .returning({ id: boardPublications.id });
    const id = row!.id;
    await syncContentPortals(
      tx,
      boardPublicationPortals,
      boardPublicationPortals.boardPublicationId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ boardPublicationId: id, portalId }),
    );
    return id;
  });
}

export async function updateBoardPublication(
  id: number,
  input: BoardPublicationInput,
  portalIds: number[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(boardPublications)
      .set({
        title: input.title,
        description: input.description ? input.description : null,
        imageMediaId: input.imageMediaId ?? null,
        publishedDate: input.publishedDate ? new Date(input.publishedDate) : null,
        status: input.status,
        distributionType: input.distributionType,
        updatedAt: new Date(),
      })
      .where(eq(boardPublications.id, id));
    await syncContentPortals(
      tx,
      boardPublicationPortals,
      boardPublicationPortals.boardPublicationId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ boardPublicationId: id, portalId }),
    );
  });
}

export async function softDeleteBoardPublication(id: number): Promise<void> {
  await db
    .update(boardPublications)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(boardPublications.id, id));
}

export async function listPublishedBoardPublicationsForPortal(
  portalSlug: string,
  page = 1,
  limit = 20,
): Promise<Paginated<BoardPublicationDTO>> {
  const [portal] = await db
    .select({ id: portals.id })
    .from(portals)
    .where(and(eq(portals.slug, portalSlug), eq(portals.status, 'active')))
    .limit(1);
  if (!portal) return { data: [], meta: { page, limit, total: 0, totalPages: 1 } };
  return listBoardPublicationsPaged({ page, limit, status: 'published', portalId: portal.id });
}
