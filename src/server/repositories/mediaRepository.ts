import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  banners,
  blogPosts,
  boletines,
  bulkJobs,
  certificates,
  companies,
  financialStatementFiles,
  media,
  popups,
  portals,
  boardPublications,
  trainingMaterials,
  users,
} from '@/lib/db/schema';
import { publicUrl } from '@/lib/storage/s3';
import type { MediaDTO } from '@/lib/dto/media';
import type { MediaKind } from '@/lib/storage/mime';
import type { Paginated, PaginationParams } from '@/lib/validations/common';

export type MediaRow = typeof media.$inferSelect;

export function toMediaDTO(row: MediaRow, uploaderName: string | null): MediaDTO {
  return {
    id: row.id,
    originalName: row.originalName,
    internalName: row.internalName,
    mimeType: row.mimeType,
    kind: row.kind,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    url: publicUrl(row.storageKey),
    thumbnailUrl: row.thumbnailKey ? publicUrl(row.thumbnailKey) : null,
    uploaderName,
    createdAt: row.createdAt.toISOString(),
  };
}

interface ListParams extends PaginationParams {
  kind?: MediaKind;
}

export async function listMediaPaged(params: ListParams): Promise<Paginated<MediaDTO>> {
  const filters = [isNull(media.deletedAt)];
  if (params.kind) filters.push(eq(media.kind, params.kind));
  if (params.q) {
    const like = or(
      ilike(media.originalName, `%${params.q}%`),
      ilike(media.internalName, `%${params.q}%`),
    );
    if (like) filters.push(like);
  }
  const where = and(...filters);
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({ media, uploaderName: users.name })
      .from(media)
      .leftJoin(users, eq(users.id, media.uploadedBy))
      .where(where)
      .orderBy(desc(media.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(media).where(where),
  ]);

  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) => toMediaDTO(r.media, r.uploaderName)),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getMedia(id: string): Promise<MediaRow | undefined> {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return row;
}

export async function insertMedia(input: {
  filename: string;
  originalName: string;
  internalName: string | null;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  thumbnailKey: string | null;
  kind: MediaKind;
  width: number | null;
  height: number | null;
  checksumSha256: string | null;
  uploadedBy: string | null;
}): Promise<MediaRow> {
  const [row] = await db.insert(media).values(input).returning();
  return row!;
}

export async function updateInternalName(
  id: string,
  internalName: string | null,
): Promise<MediaRow | undefined> {
  const [row] = await db
    .update(media)
    .set({ internalName })
    .where(eq(media.id, id))
    .returning();
  return row;
}

export async function softDeleteMedia(id: string): Promise<void> {
  await db.update(media).set({ deletedAt: new Date() }).where(eq(media.id, id));
}

/** ¿El archivo está referenciado por alguna entidad? */
export async function mediaInUse(id: string): Promise<boolean> {
  const one = sql`1`;
  const checks = await Promise.all([
    db.select({ x: one }).from(portals).where(eq(portals.logoMediaId, id)).limit(1),
    db.select({ x: one }).from(companies).where(eq(companies.logoMediaId, id)).limit(1),
    db
      .select({ x: one })
      .from(boletines)
      .where(or(eq(boletines.pdfMediaId, id), eq(boletines.coverMediaId, id)))
      .limit(1),
    db
      .select({ x: one })
      .from(boardPublications)
      .where(eq(boardPublications.imageMediaId, id))
      .limit(1),
    db
      .select({ x: one })
      .from(blogPosts)
      .where(or(eq(blogPosts.featuredMediaId, id), eq(blogPosts.ogMediaId, id)))
      .limit(1),
    db
      .select({ x: one })
      .from(trainingMaterials)
      .where(
        or(eq(trainingMaterials.fileMediaId, id), eq(trainingMaterials.imageMediaId, id)),
      )
      .limit(1),
    db
      .select({ x: one })
      .from(popups)
      .where(or(eq(popups.imageMediaId, id), eq(popups.mobileImageMediaId, id)))
      .limit(1),
    db
      .select({ x: one })
      .from(banners)
      .where(or(eq(banners.imageMediaId, id), eq(banners.mobileImageMediaId, id)))
      .limit(1),
    db
      .select({ x: one })
      .from(financialStatementFiles)
      .where(eq(financialStatementFiles.mediaId, id))
      .limit(1),
    db.select({ x: one }).from(certificates).where(eq(certificates.pdfMediaId, id)).limit(1),
    db.select({ x: one }).from(bulkJobs).where(eq(bulkJobs.errorReportMediaId, id)).limit(1),
  ]);
  return checks.some((rows) => rows.length > 0);
}
