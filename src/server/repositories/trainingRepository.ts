import { and, count, desc, eq, gte, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db/client';
import {
  categories,
  media,
  portals,
  trainingMaterialPortals,
  trainingMaterials,
  users,
} from '@/lib/db/schema';
import { mediaUrl } from '@/server/repositories/portalRepository';
import {
  portalVisibilityCondition,
  syncContentPortals,
} from '@/server/repositories/portalsSync';
import type { PortalRef, TrainingDTO } from '@/lib/dto/training';
import type { TrainingInput } from '@/lib/validations/training';
import type { Paginated, PaginationParams } from '@/lib/validations/common';

const fileM = alias(media, 'file_m');
const imgM = alias(media, 'img_m');

interface ListParams extends PaginationParams {
  status?: 'draft' | 'published' | 'archived';
  categoryId?: number;
  portalId?: number;
  since?: Date;
}

const baseColumns = {
  training: trainingMaterials,
  categoryName: categories.name,
  fileKey: fileM.storageKey,
  fileName: fileM.originalName,
  fileInternal: fileM.internalName,
  fileKind: fileM.kind,
  imgThumb: imgM.thumbnailKey,
  imgKey: imgM.storageKey,
  authorName: users.name,
};

type BaseRow = {
  training: typeof trainingMaterials.$inferSelect;
  categoryName: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileInternal: string | null;
  fileKind: TrainingDTO['fileKind'];
  imgThumb: string | null;
  imgKey: string | null;
  authorName: string | null;
};

function rowToDTO(r: BaseRow, portalRefs: PortalRef[]): TrainingDTO {
  const t = r.training;
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    publishedDate: t.publishedDate ? t.publishedDate.toISOString() : null,
    distributionType: t.distributionType,
    portals: portalRefs,
    categoryId: t.categoryId,
    categoryName: r.categoryName,
    fileMediaId: t.fileMediaId,
    fileUrl: r.fileKey ? mediaUrl(null, r.fileKey) : null,
    fileName: r.fileInternal ?? r.fileName,
    fileKind: r.fileKind,
    imageMediaId: t.imageMediaId,
    imageUrl: mediaUrl(r.imgThumb, r.imgKey),
    authorName: r.authorName,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

async function portalRefsFor(ids: number[]): Promise<Map<number, PortalRef[]>> {
  const map = new Map<number, PortalRef[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      tId: trainingMaterialPortals.trainingMaterialId,
      id: portals.id,
      name: portals.name,
      slug: portals.slug,
    })
    .from(trainingMaterialPortals)
    .innerJoin(portals, eq(portals.id, trainingMaterialPortals.portalId))
    .where(inArray(trainingMaterialPortals.trainingMaterialId, ids));
  for (const row of rows) {
    const list = map.get(row.tId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    map.set(row.tId, list);
  }
  return map;
}

export async function listTrainingPaged(
  params: ListParams,
): Promise<Paginated<TrainingDTO>> {
  const filters: SQL[] = [isNull(trainingMaterials.deletedAt)];
  if (params.status) filters.push(eq(trainingMaterials.status, params.status));
  if (params.categoryId) filters.push(eq(trainingMaterials.categoryId, params.categoryId));
  if (params.since) filters.push(gte(trainingMaterials.publishedDate, params.since));
  if (params.q) {
    const like = or(
      ilike(trainingMaterials.title, `%${params.q}%`),
      ilike(trainingMaterials.description, `%${params.q}%`),
    );
    if (like) filters.push(like);
  }
  if (params.portalId) {
    filters.push(
      portalVisibilityCondition(
        trainingMaterials.distributionType,
        trainingMaterials.id,
        trainingMaterialPortals,
        trainingMaterialPortals.trainingMaterialId,
        trainingMaterialPortals.portalId,
        params.portalId,
      ),
    );
  }
  const where = and(...filters);
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(baseColumns)
      .from(trainingMaterials)
      .leftJoin(categories, eq(categories.id, trainingMaterials.categoryId))
      .leftJoin(fileM, eq(fileM.id, trainingMaterials.fileMediaId))
      .leftJoin(imgM, eq(imgM.id, trainingMaterials.imageMediaId))
      .leftJoin(users, eq(users.id, trainingMaterials.authorId))
      .where(where)
      .orderBy(desc(trainingMaterials.publishedDate), desc(trainingMaterials.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(trainingMaterials).where(where),
  ]);

  const refs = await portalRefsFor(rows.map((r) => r.training.id));
  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) => rowToDTO(r, refs.get(r.training.id) ?? [])),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getTraining(id: number): Promise<TrainingDTO | undefined> {
  const [row] = await db
    .select(baseColumns)
    .from(trainingMaterials)
    .leftJoin(categories, eq(categories.id, trainingMaterials.categoryId))
    .leftJoin(fileM, eq(fileM.id, trainingMaterials.fileMediaId))
    .leftJoin(imgM, eq(imgM.id, trainingMaterials.imageMediaId))
    .leftJoin(users, eq(users.id, trainingMaterials.authorId))
    .where(and(eq(trainingMaterials.id, id), isNull(trainingMaterials.deletedAt)))
    .limit(1);
  if (!row) return undefined;
  const refs = await portalRefsFor([id]);
  return rowToDTO(row, refs.get(id) ?? []);
}

export async function getTrainingRow(id: number) {
  const [row] = await db
    .select()
    .from(trainingMaterials)
    .where(and(eq(trainingMaterials.id, id), isNull(trainingMaterials.deletedAt)))
    .limit(1);
  return row;
}

function baseSet(input: TrainingInput) {
  return {
    title: input.title,
    description: input.description ? input.description : null,
    fileMediaId: input.fileMediaId ?? null,
    imageMediaId: input.imageMediaId ?? null,
    categoryId: input.categoryId ?? null,
    publishedDate: input.publishedDate ? new Date(input.publishedDate) : null,
    status: input.status,
    distributionType: input.distributionType,
  };
}

export async function createTraining(
  input: TrainingInput,
  portalIds: number[],
  authorId: string | null,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(trainingMaterials)
      .values({ ...baseSet(input), authorId })
      .returning({ id: trainingMaterials.id });
    const id = row!.id;
    await syncContentPortals(
      tx,
      trainingMaterialPortals,
      trainingMaterialPortals.trainingMaterialId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ trainingMaterialId: id, portalId }),
    );
    return id;
  });
}

export async function updateTraining(
  id: number,
  input: TrainingInput,
  portalIds: number[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(trainingMaterials)
      .set({ ...baseSet(input), updatedAt: new Date() })
      .where(eq(trainingMaterials.id, id));
    await syncContentPortals(
      tx,
      trainingMaterialPortals,
      trainingMaterialPortals.trainingMaterialId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ trainingMaterialId: id, portalId }),
    );
  });
}

export async function softDeleteTraining(id: number): Promise<void> {
  await db
    .update(trainingMaterials)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(trainingMaterials.id, id));
}

export async function listPublishedTrainingForPortal(
  portalSlug: string,
  page = 1,
  limit = 20,
): Promise<Paginated<TrainingDTO>> {
  const [portal] = await db
    .select({ id: portals.id })
    .from(portals)
    .where(and(eq(portals.slug, portalSlug), eq(portals.status, 'active')))
    .limit(1);
  if (!portal) return { data: [], meta: { page, limit, total: 0, totalPages: 1 } };
  return listTrainingPaged({ page, limit, status: 'published', portalId: portal.id });
}
