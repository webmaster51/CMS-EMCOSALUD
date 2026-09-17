import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db/client';
import { banners, bannerPortals, media, portals, users } from '@/lib/db/schema';
import { mediaUrl } from '@/server/repositories/portalRepository';
import {
  portalVisibilityCondition,
  syncContentPortals,
} from '@/server/repositories/portalsSync';
import type { BannerDTO, BannerPublicDTO, PortalRef } from '@/lib/dto/banner';
import type { BannerInput } from '@/lib/validations/banner';
import type { Paginated, PaginationParams } from '@/lib/validations/common';

const imgM = alias(media, 'banner_img_m');
const mobM = alias(media, 'banner_mob_m');

interface ListParams extends PaginationParams {
  status?: BannerDTO['status'];
  portalId?: number;
}

const baseColumns = {
  banner: banners,
  imgThumb: imgM.thumbnailKey,
  imgKey: imgM.storageKey,
  mobThumb: mobM.thumbnailKey,
  mobKey: mobM.storageKey,
  authorName: users.name,
};

type BaseRow = {
  banner: typeof banners.$inferSelect;
  imgThumb: string | null;
  imgKey: string | null;
  mobThumb: string | null;
  mobKey: string | null;
  authorName: string | null;
};

function rowToDTO(r: BaseRow, portalRefs: PortalRef[]): BannerDTO {
  const b = r.banner;
  return {
    id: b.id,
    internalName: b.internalName,
    title: b.title,
    subtitle: b.subtitle,
    description: b.description,
    imageMediaId: b.imageMediaId,
    imageUrl: mediaUrl(r.imgThumb, r.imgKey),
    mobileImageMediaId: b.mobileImageMediaId,
    mobileImageUrl: mediaUrl(r.mobThumb, r.mobKey),
    buttonText: b.buttonText,
    url: b.url,
    linkType: b.linkType,
    sortOrder: b.sortOrder,
    startsAt: b.startsAt ? b.startsAt.toISOString() : null,
    endsAt: b.endsAt ? b.endsAt.toISOString() : null,
    status: b.status,
    distributionType: b.distributionType,
    portals: portalRefs,
    authorName: r.authorName,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

async function portalsFor(ids: string[]): Promise<Map<string, PortalRef[]>> {
  const portalMap = new Map<string, PortalRef[]>();
  if (ids.length === 0) return portalMap;
  const rows = await db
    .select({
      bannerId: bannerPortals.bannerId,
      id: portals.id,
      name: portals.name,
      slug: portals.slug,
    })
    .from(bannerPortals)
    .innerJoin(portals, eq(portals.id, bannerPortals.portalId))
    .where(inArray(bannerPortals.bannerId, ids));
  for (const row of rows) {
    const list = portalMap.get(row.bannerId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    portalMap.set(row.bannerId, list);
  }
  return portalMap;
}

export async function listBannersPaged(params: ListParams): Promise<Paginated<BannerDTO>> {
  const filters: SQL[] = [isNull(banners.deletedAt)];
  if (params.status) filters.push(eq(banners.status, params.status));
  if (params.q) {
    const like = or(
      ilike(banners.internalName, `%${params.q}%`),
      ilike(banners.title, `%${params.q}%`),
    );
    if (like) filters.push(like);
  }
  if (params.portalId) {
    filters.push(
      portalVisibilityCondition(
        banners.distributionType,
        banners.id,
        bannerPortals,
        bannerPortals.bannerId,
        bannerPortals.portalId,
        params.portalId,
      ),
    );
  }
  const where = and(...filters);
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(baseColumns)
      .from(banners)
      .leftJoin(imgM, eq(imgM.id, banners.imageMediaId))
      .leftJoin(mobM, eq(mobM.id, banners.mobileImageMediaId))
      .leftJoin(users, eq(users.id, banners.createdBy))
      .where(where)
      .orderBy(asc(banners.sortOrder), desc(banners.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(banners).where(where),
  ]);

  const ids = rows.map((r) => r.banner.id);
  const portalMap = await portalsFor(ids);
  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) => rowToDTO(r, portalMap.get(r.banner.id) ?? [])),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getBanner(id: string): Promise<BannerDTO | undefined> {
  const [row] = await db
    .select(baseColumns)
    .from(banners)
    .leftJoin(imgM, eq(imgM.id, banners.imageMediaId))
    .leftJoin(mobM, eq(mobM.id, banners.mobileImageMediaId))
    .leftJoin(users, eq(users.id, banners.createdBy))
    .where(and(eq(banners.id, id), isNull(banners.deletedAt)))
    .limit(1);
  if (!row) return undefined;
  const portalMap = await portalsFor([id]);
  return rowToDTO(row, portalMap.get(id) ?? []);
}

export async function getBannerRow(id: string) {
  const [row] = await db
    .select()
    .from(banners)
    .where(and(eq(banners.id, id), isNull(banners.deletedAt)))
    .limit(1);
  return row;
}

/** Siguiente posición libre en el carrusel (para añadir banners nuevos al final). */
async function nextSortOrder(): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${banners.sortOrder})` })
    .from(banners)
    .where(isNull(banners.deletedAt));
  return (row?.max ?? -1) + 1;
}

function columns(input: BannerInput) {
  return {
    internalName: input.internalName,
    title: input.title ? input.title : null,
    subtitle: input.subtitle ? input.subtitle : null,
    description: input.description ? input.description : null,
    imageMediaId: input.imageMediaId ?? null,
    mobileImageMediaId: input.mobileImageMediaId ?? null,
    buttonText: input.buttonText ? input.buttonText : null,
    url: input.url ? input.url : null,
    linkType: input.linkType,
    sortOrder: input.sortOrder,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    status: input.status,
    distributionType: input.distributionType,
  };
}

export async function createBanner(
  input: BannerInput,
  portalIds: number[],
  createdBy: string | null,
): Promise<string> {
  const cols = columns(input);
  if (!input.sortOrder) cols.sortOrder = await nextSortOrder();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(banners)
      .values({ ...cols, createdBy })
      .returning({ id: banners.id });
    const id = row!.id;
    await syncContentPortals(
      tx,
      bannerPortals,
      bannerPortals.bannerId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ bannerId: id, portalId }),
    );
    return id;
  });
}

export async function updateBanner(
  id: string,
  input: BannerInput,
  portalIds: number[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(banners)
      .set({ ...columns(input), updatedAt: new Date() })
      .where(eq(banners.id, id));
    await syncContentPortals(
      tx,
      bannerPortals,
      bannerPortals.bannerId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ bannerId: id, portalId }),
    );
  });
}

export async function softDeleteBanner(id: string): Promise<void> {
  await db
    .update(banners)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(banners.id, id));
}

/** Reasigna `sort_order` según el orden del array de ids (posición = índice). */
export async function reorderBanners(ids: string[]): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(banners)
        .set({ sortOrder: i, updatedAt: now })
        .where(and(eq(banners.id, ids[i]!), isNull(banners.deletedAt)));
    }
  });
}

/* ────────────────────────────────────────────────────────────
 * Resolución para los sitios (API pública). Los banners salen fijos
 * en la página de inicio del portal, ordenados como carrusel.
 * ──────────────────────────────────────────────────────────── */

export async function resolveBannersForPortal(
  portalSlug: string,
): Promise<BannerPublicDTO[]> {
  const now = new Date();
  const rows = await db
    .select(baseColumns)
    .from(banners)
    .leftJoin(imgM, eq(imgM.id, banners.imageMediaId))
    .leftJoin(mobM, eq(mobM.id, banners.mobileImageMediaId))
    .leftJoin(users, eq(users.id, banners.createdBy))
    .where(
      and(
        isNull(banners.deletedAt),
        eq(banners.status, 'active'),
        sql`(${banners.startsAt} IS NULL OR ${banners.startsAt} <= ${now})`,
        sql`(${banners.endsAt} IS NULL OR ${banners.endsAt} >= ${now})`,
        sql`(${banners.distributionType} = 'all' OR EXISTS (
          SELECT 1 FROM ${bannerPortals} bp JOIN ${portals} pt ON pt.id = bp.portal_id
          WHERE bp.banner_id = ${banners.id} AND pt.slug = ${portalSlug} AND pt.status = 'active'
        ))`,
      ),
    )
    .orderBy(asc(banners.sortOrder), desc(banners.createdAt));

  return rows.map((r) => ({
    id: r.banner.id,
    title: r.banner.title,
    subtitle: r.banner.subtitle,
    description: r.banner.description,
    imageUrl: mediaUrl(r.imgThumb, r.imgKey),
    mobileImageUrl: mediaUrl(r.mobThumb, r.mobKey),
    buttonText: r.banner.buttonText,
    url: r.banner.url,
    linkType: r.banner.linkType,
    sortOrder: r.banner.sortOrder,
  }));
}

/** Transiciones de estado por fecha (scheduler). Devuelve cuántas cambió. */
export async function advanceBannerStates(): Promise<{ activated: number; finished: number }> {
  const now = new Date();
  const activated = await db
    .update(banners)
    .set({ status: 'active', updatedAt: now })
    .where(
      and(
        eq(banners.status, 'scheduled'),
        isNull(banners.deletedAt),
        sql`${banners.startsAt} IS NOT NULL AND ${banners.startsAt} <= ${now}`,
        sql`(${banners.endsAt} IS NULL OR ${banners.endsAt} > ${now})`,
      ),
    )
    .returning({ id: banners.id });
  const finished = await db
    .update(banners)
    .set({ status: 'finished', updatedAt: now })
    .where(
      and(
        inArray(banners.status, ['active', 'scheduled']),
        isNull(banners.deletedAt),
        sql`${banners.endsAt} IS NOT NULL AND ${banners.endsAt} <= ${now}`,
      ),
    )
    .returning({ id: banners.id });
  return { activated: activated.length, finished: finished.length };
}
