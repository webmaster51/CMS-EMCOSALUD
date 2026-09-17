import type { BannerInput } from '@/lib/validations/banner';
import { normalizeDistribution } from '@/lib/validations/distribution';
import { recordAudit } from '@/server/services/auditService';
import { queueRebuild } from '@/server/services/rebuildService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import { existingPortalIds } from '@/server/repositories/portalsSync';
import * as repo from '@/server/repositories/bannerRepository';
import type { BannerDTO } from '@/lib/dto/banner';

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

async function resolvePortals(input: BannerInput) {
  const norm = normalizeDistribution(input);
  const ids = await existingPortalIds(norm.portalIds);
  if (norm.distributionType !== 'all' && ids.length !== norm.portalIds.length) {
    return { ok: false as const, error: 'Alguno de los portales seleccionados no existe' };
  }
  return { ok: true as const, ids };
}

const LIVE = new Set(['active', 'scheduled']);

export async function createBanner(
  input: BannerInput,
  actor: Actor,
): Promise<ServiceResult<BannerDTO>> {
  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  const id = await repo.createBanner(input, portals.ids, actor.userId || null);
  const dto = await repo.getBanner(id);

  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'banners',
    entityType: 'banner',
    entityId: id,
    summary: `Creó el banner "${input.internalName}" (${input.status})`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (LIVE.has(input.status)) {
    queueRebuild('banner.create', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function updateBanner(
  id: string,
  input: BannerInput,
  actor: Actor,
): Promise<ServiceResult<BannerDTO>> {
  const existing = await repo.getBannerRow(id);
  if (!existing) return fail(404, 'Banner no encontrado');

  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  await repo.updateBanner(id, input, portals.ids);
  const dto = await repo.getBanner(id);

  await recordAudit({
    userId: actor.userId,
    action: 'update',
    module: 'banners',
    entityType: 'banner',
    entityId: id,
    summary: `Actualizó el banner "${input.internalName}" (${input.status})`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (LIVE.has(input.status) || LIVE.has(existing.status)) {
    queueRebuild('banner.update', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function reorderBanners(
  ids: string[],
  actor: Actor,
): Promise<ServiceResult<{ ids: string[] }>> {
  await repo.reorderBanners(ids);
  await recordAudit({
    userId: actor.userId,
    action: 'reorder',
    module: 'banners',
    entityType: 'banner',
    summary: `Reordenó el carrusel de banners (${ids.length})`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  queueRebuild('banner.reorder', { distributionType: 'unknown', portalIds: [] });
  return done({ ids });
}

export async function deleteBanner(
  id: string,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await repo.getBannerRow(id);
  if (!existing) return fail(404, 'Banner no encontrado');

  await repo.softDeleteBanner(id);
  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'banners',
    entityType: 'banner',
    entityId: id,
    summary: `Eliminó el banner "${existing.internalName}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (LIVE.has(existing.status)) {
    queueRebuild('banner.delete', {
      distributionType: existing.distributionType,
      portalIds: [],
    });
  }
  return done({ id });
}
