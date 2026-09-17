import { and, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db/client';
import { media, popupPages, popupPortals, popups, portals, users } from '@/lib/db/schema';
import { mediaUrl } from '@/server/repositories/portalRepository';
import {
  portalVisibilityCondition,
  syncContentPortals,
} from '@/server/repositories/portalsSync';
import type { PopupDTO, PopupPublicDTO, PortalRef } from '@/lib/dto/popup';
import type { PopupInput } from '@/lib/validations/popup';
import type { Paginated, PaginationParams } from '@/lib/validations/common';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const imgM = alias(media, 'img_m');
const mobM = alias(media, 'mob_m');

interface ListParams extends PaginationParams {
  status?: PopupDTO['status'];
  portalId?: number;
}

const baseColumns = {
  popup: popups,
  imgThumb: imgM.thumbnailKey,
  imgKey: imgM.storageKey,
  mobThumb: mobM.thumbnailKey,
  mobKey: mobM.storageKey,
  authorName: users.name,
};

type BaseRow = {
  popup: typeof popups.$inferSelect;
  imgThumb: string | null;
  imgKey: string | null;
  mobThumb: string | null;
  mobKey: string | null;
  authorName: string | null;
};

function rowToDTO(r: BaseRow, portalRefs: PortalRef[], paths: string[]): PopupDTO {
  const p = r.popup;
  return {
    id: p.id,
    internalName: p.internalName,
    title: p.title,
    subtitle: p.subtitle,
    description: p.description,
    imageMediaId: p.imageMediaId,
    imageUrl: mediaUrl(r.imgThumb, r.imgKey),
    mobileImageMediaId: p.mobileImageMediaId,
    mobileImageUrl: mediaUrl(r.mobThumb, r.mobKey),
    buttonText: p.buttonText,
    url: p.url,
    linkType: p.linkType,
    pageMode: p.pageMode,
    paths,
    startsAt: p.startsAt ? p.startsAt.toISOString() : null,
    endsAt: p.endsAt ? p.endsAt.toISOString() : null,
    status: p.status,
    priority: p.priority,
    frequency: p.frequency,
    frequencyDays: p.frequencyDays,
    device: p.device,
    distributionType: p.distributionType,
    portals: portalRefs,
    authorName: r.authorName,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

async function auxFor(ids: string[]) {
  const portalMap = new Map<string, PortalRef[]>();
  const pathMap = new Map<string, string[]>();
  if (ids.length === 0) return { portals: portalMap, paths: pathMap };
  const [portalRows, pageRows] = await Promise.all([
    db
      .select({
        popupId: popupPortals.popupId,
        id: portals.id,
        name: portals.name,
        slug: portals.slug,
      })
      .from(popupPortals)
      .innerJoin(portals, eq(portals.id, popupPortals.portalId))
      .where(inArray(popupPortals.popupId, ids)),
    db
      .select({ popupId: popupPages.popupId, path: popupPages.path })
      .from(popupPages)
      .where(inArray(popupPages.popupId, ids)),
  ]);
  for (const row of portalRows) {
    const list = portalMap.get(row.popupId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    portalMap.set(row.popupId, list);
  }
  for (const row of pageRows) {
    const list = pathMap.get(row.popupId) ?? [];
    list.push(row.path);
    pathMap.set(row.popupId, list);
  }
  return { portals: portalMap, paths: pathMap };
}

export async function listPopupsPaged(params: ListParams): Promise<Paginated<PopupDTO>> {
  const filters: SQL[] = [isNull(popups.deletedAt)];
  if (params.status) filters.push(eq(popups.status, params.status));
  if (params.q) {
    const like = or(
      ilike(popups.internalName, `%${params.q}%`),
      ilike(popups.title, `%${params.q}%`),
    );
    if (like) filters.push(like);
  }
  if (params.portalId) {
    filters.push(
      portalVisibilityCondition(
        popups.distributionType,
        popups.id,
        popupPortals,
        popupPortals.popupId,
        popupPortals.portalId,
        params.portalId,
      ),
    );
  }
  const where = and(...filters);
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(baseColumns)
      .from(popups)
      .leftJoin(imgM, eq(imgM.id, popups.imageMediaId))
      .leftJoin(mobM, eq(mobM.id, popups.mobileImageMediaId))
      .leftJoin(users, eq(users.id, popups.createdBy))
      .where(where)
      .orderBy(desc(popups.priority), desc(popups.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(popups).where(where),
  ]);

  const ids = rows.map((r) => r.popup.id);
  const aux = await auxFor(ids);
  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) =>
      rowToDTO(r, aux.portals.get(r.popup.id) ?? [], aux.paths.get(r.popup.id) ?? []),
    ),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getPopup(id: string): Promise<PopupDTO | undefined> {
  const [row] = await db
    .select(baseColumns)
    .from(popups)
    .leftJoin(imgM, eq(imgM.id, popups.imageMediaId))
    .leftJoin(mobM, eq(mobM.id, popups.mobileImageMediaId))
    .leftJoin(users, eq(users.id, popups.createdBy))
    .where(and(eq(popups.id, id), isNull(popups.deletedAt)))
    .limit(1);
  if (!row) return undefined;
  const aux = await auxFor([id]);
  return rowToDTO(row, aux.portals.get(id) ?? [], aux.paths.get(id) ?? []);
}

export async function getPopupRow(id: string) {
  const [row] = await db
    .select()
    .from(popups)
    .where(and(eq(popups.id, id), isNull(popups.deletedAt)))
    .limit(1);
  return row;
}

async function syncPages(tx: Tx, popupId: string, pageMode: string, paths: string[]) {
  await tx.delete(popupPages).where(eq(popupPages.popupId, popupId));
  if (pageMode !== 'specific_pages' || paths.length === 0) return;
  const unique = Array.from(new Set(paths));
  await tx.insert(popupPages).values(unique.map((path) => ({ popupId, path })));
}

function columns(input: PopupInput) {
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
    pageMode: input.pageMode,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    status: input.status,
    priority: input.priority,
    frequency: input.frequency,
    frequencyDays: input.frequency === 'every_x_days' ? (input.frequencyDays ?? null) : null,
    device: input.device,
    distributionType: input.distributionType,
  };
}

export async function createPopup(
  input: PopupInput,
  portalIds: number[],
  createdBy: string | null,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(popups)
      .values({ ...columns(input), createdBy })
      .returning({ id: popups.id });
    const id = row!.id;
    await syncContentPortals(
      tx,
      popupPortals,
      popupPortals.popupId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ popupId: id, portalId }),
    );
    await syncPages(tx, id, input.pageMode, input.paths);
    return id;
  });
}

export async function updatePopup(
  id: string,
  input: PopupInput,
  portalIds: number[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(popups)
      .set({ ...columns(input), updatedAt: new Date() })
      .where(eq(popups.id, id));
    await syncContentPortals(
      tx,
      popupPortals,
      popupPortals.popupId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ popupId: id, portalId }),
    );
    await syncPages(tx, id, input.pageMode, input.paths);
  });
}

export async function softDeletePopup(id: string): Promise<void> {
  await db
    .update(popups)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(popups.id, id));
}

/* ────────────────────────────────────────────────────────────
 * Resolución para los sitios (plan §22). Se expone en la Fase 14.
 * ──────────────────────────────────────────────────────────── */

export async function resolvePopupsForPortal(
  portalSlug: string,
  path: string,
  device: 'all' | 'desktop' | 'tablet' | 'mobile' = 'all',
): Promise<PopupPublicDTO[]> {
  const now = new Date();
  const rows = await db
    .select(baseColumns)
    .from(popups)
    .leftJoin(imgM, eq(imgM.id, popups.imageMediaId))
    .leftJoin(mobM, eq(mobM.id, popups.mobileImageMediaId))
    .leftJoin(users, eq(users.id, popups.createdBy))
    .where(
      and(
        isNull(popups.deletedAt),
        eq(popups.status, 'active'),
        sql`(${popups.startsAt} IS NULL OR ${popups.startsAt} <= ${now})`,
        sql`(${popups.endsAt} IS NULL OR ${popups.endsAt} >= ${now})`,
        device === 'all'
          ? sql`true`
          : sql`(${popups.device} = 'all' OR ${popups.device} = ${device})`,
        sql`(${popups.distributionType} = 'all' OR EXISTS (
          SELECT 1 FROM ${popupPortals} pp JOIN ${portals} pt ON pt.id = pp.portal_id
          WHERE pp.popup_id = ${popups.id} AND pt.slug = ${portalSlug} AND pt.status = 'active'
        ))`,
        sql`(${popups.pageMode} = 'all_pages' OR EXISTS (
          SELECT 1 FROM ${popupPages} pg WHERE pg.popup_id = ${popups.id} AND pg.path = ${path}
        ))`,
      ),
    )
    .orderBy(desc(popups.priority), desc(popups.createdAt));

  return rows.map((r) => ({
    id: r.popup.id,
    title: r.popup.title,
    subtitle: r.popup.subtitle,
    description: r.popup.description,
    imageUrl: mediaUrl(r.imgThumb, r.imgKey),
    mobileImageUrl: mediaUrl(r.mobThumb, r.mobKey),
    buttonText: r.popup.buttonText,
    url: r.popup.url,
    linkType: r.popup.linkType,
    priority: r.popup.priority,
    frequency: r.popup.frequency,
    frequencyDays: r.popup.frequencyDays,
    device: r.popup.device,
  }));
}

/** Transiciones de estado por fecha (scheduler). Devuelve cuántas cambió. */
export async function advancePopupStates(): Promise<{ activated: number; finished: number }> {
  const now = new Date();
  const activated = await db
    .update(popups)
    .set({ status: 'active', updatedAt: now })
    .where(
      and(
        eq(popups.status, 'scheduled'),
        isNull(popups.deletedAt),
        sql`${popups.startsAt} IS NOT NULL AND ${popups.startsAt} <= ${now}`,
        sql`(${popups.endsAt} IS NULL OR ${popups.endsAt} > ${now})`,
      ),
    )
    .returning({ id: popups.id });
  const finished = await db
    .update(popups)
    .set({ status: 'finished', updatedAt: now })
    .where(
      and(
        inArray(popups.status, ['active', 'scheduled']),
        isNull(popups.deletedAt),
        sql`${popups.endsAt} IS NOT NULL AND ${popups.endsAt} <= ${now}`,
      ),
    )
    .returning({ id: popups.id });
  return { activated: activated.length, finished: finished.length };
}
