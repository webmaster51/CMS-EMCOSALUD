import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  apiKeys,
  bannerPortals,
  blogPostPortals,
  boletinPortals,
  categories,
  financialStatementPortals,
  media,
  popupPortals,
  portals,
  boardPublicationPortals,
  trainingMaterialPortals,
} from '@/lib/db/schema';
import { publicUrl } from '@/lib/storage/s3';
import type { Paginated, PaginationParams } from '@/lib/validations/common';
import type { PortalInput } from '@/lib/validations/portal';

/** URL de logo a partir de la miniatura o el original. */
/** URL de archivo a partir del original (prioridad) o de la miniatura como alternativa. */
export function mediaUrl(
  thumbnailKey: string | null,
  storageKey: string | null,
  preferThumbnail = false,
): string | null {
  if (preferThumbnail && thumbnailKey) return publicUrl(thumbnailKey);
  if (storageKey) return publicUrl(storageKey);
  if (thumbnailKey) return publicUrl(thumbnailKey);
  return null;
}

export type PortalListItem = {
  id: number;
  name: string;
  shortName: string;
  slug: string;
  status: 'active' | 'inactive';
};

export type PortalRow = typeof portals.$inferSelect & {
  apiKeyCount: number;
  logoUrl: string | null;
};

const listColumns = {
  id: portals.id,
  name: portals.name,
  shortName: portals.shortName,
  slug: portals.slug,
  status: portals.status,
};

export async function listPortals(onlyActive = false): Promise<PortalListItem[]> {
  const rows = await db.select(listColumns).from(portals).orderBy(asc(portals.name));
  return onlyActive ? rows.filter((r) => r.status === 'active') : rows;
}

export async function findPortalBySlug(slug: string): Promise<PortalListItem | undefined> {
  const [row] = await db
    .select(listColumns)
    .from(portals)
    .where(eq(portals.slug, slug))
    .limit(1);
  return row;
}

export async function listPortalsPaged(
  params: PaginationParams,
): Promise<Paginated<PortalRow>> {
  const where = params.q
    ? or(
        ilike(portals.name, `%${params.q}%`),
        ilike(portals.slug, `%${params.q}%`),
        ilike(portals.url, `%${params.q}%`),
      )
    : undefined;

  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        portal: portals,
        logoThumb: media.thumbnailKey,
        logoKey: media.storageKey,
        apiKeyCount: sql<number>`(
          select count(*) from ${apiKeys}
          where ${apiKeys.portalId} = ${portals.id} and ${apiKeys.revokedAt} is null
        )`,
      })
      .from(portals)
      .leftJoin(media, eq(media.id, portals.logoMediaId))
      .where(where)
      .orderBy(desc(portals.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(portals).where(where),
  ]);

  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) => ({
      ...r.portal,
      apiKeyCount: Number(r.apiKeyCount),
      logoUrl: mediaUrl(r.logoThumb, r.logoKey),
    })),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getPortal(id: number): Promise<typeof portals.$inferSelect | undefined> {
  const [row] = await db.select().from(portals).where(eq(portals.id, id)).limit(1);
  return row;
}

export async function slugTaken(slug: string, exceptId?: number): Promise<boolean> {
  const [row] = await db
    .select({ id: portals.id })
    .from(portals)
    .where(exceptId ? and(eq(portals.slug, slug), ne(portals.id, exceptId)) : eq(portals.slug, slug))
    .limit(1);
  return Boolean(row);
}

function normalize(data: PortalInput) {
  return {
    name: data.name,
    shortName: data.shortName,
    slug: data.slug,
    url: data.url,
    description: data.description ? data.description : null,
    status: data.status,
    logoMediaId: data.logoMediaId ?? null,
    deployHookUrl: data.deployHookUrl ? data.deployHookUrl : null,
  };
}

/** Portal + URL de su logo (para la ficha de detalle). */
export async function getPortalWithLogo(id: number) {
  const [row] = await db
    .select({
      portal: portals,
      logoThumb: media.thumbnailKey,
      logoKey: media.storageKey,
    })
    .from(portals)
    .leftJoin(media, eq(media.id, portals.logoMediaId))
    .where(eq(portals.id, id))
    .limit(1);
  return row ? { ...row.portal, logoUrl: mediaUrl(row.logoThumb, row.logoKey) } : undefined;
}

export async function createPortal(data: PortalInput): Promise<typeof portals.$inferSelect> {
  const [row] = await db.insert(portals).values(normalize(data)).returning();
  return row!;
}

export async function updatePortal(
  id: number,
  data: PortalInput,
): Promise<typeof portals.$inferSelect | undefined> {
  const [row] = await db
    .update(portals)
    .set({ ...normalize(data), updatedAt: new Date() })
    .where(eq(portals.id, id))
    .returning();
  return row;
}

export async function deletePortal(id: number): Promise<void> {
  await db.delete(portals).where(eq(portals.id, id));
}

/** ¿El portal está referenciado por algún contenido o categoría? */
export async function portalInUse(id: number): Promise<boolean> {
  const checks = await Promise.all([
    db.select({ x: sql`1` }).from(blogPostPortals).where(eq(blogPostPortals.portalId, id)).limit(1),
    db.select({ x: sql`1` }).from(boletinPortals).where(eq(boletinPortals.portalId, id)).limit(1),
    db
      .select({ x: sql`1` })
      .from(boardPublicationPortals)
      .where(eq(boardPublicationPortals.portalId, id))
      .limit(1),
    db
      .select({ x: sql`1` })
      .from(trainingMaterialPortals)
      .where(eq(trainingMaterialPortals.portalId, id))
      .limit(1),
    db.select({ x: sql`1` }).from(popupPortals).where(eq(popupPortals.portalId, id)).limit(1),
    db.select({ x: sql`1` }).from(bannerPortals).where(eq(bannerPortals.portalId, id)).limit(1),
    db
      .select({ x: sql`1` })
      .from(financialStatementPortals)
      .where(eq(financialStatementPortals.portalId, id))
      .limit(1),
    db.select({ x: sql`1` }).from(categories).where(eq(categories.portalId, id)).limit(1),
  ]);
  return checks.some((rows) => rows.length > 0);
}

/* ---- API keys ---- */

export type ApiKeyRow = {
  id: number;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export async function listApiKeys(portalId: number): Promise<ApiKeyRow[]> {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.portalId, portalId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function insertApiKey(input: {
  portalId: number;
  name: string;
  keyHash: string;
  keyPrefix: string;
  createdBy: string | null;
}): Promise<number> {
  const [row] = await db
    .insert(apiKeys)
    .values(input)
    .returning({ id: apiKeys.id });
  return row!.id;
}

export async function revokeApiKey(portalId: number, keyId: number): Promise<boolean> {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.portalId, portalId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  return Boolean(row);
}
