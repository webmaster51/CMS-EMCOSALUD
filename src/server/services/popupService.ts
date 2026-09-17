import type { PopupInput } from '@/lib/validations/popup';
import { normalizeDistribution } from '@/lib/validations/distribution';
import { recordAudit } from '@/server/services/auditService';
import { queueRebuild } from '@/server/services/rebuildService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import { existingPortalIds } from '@/server/repositories/portalsSync';
import * as repo from '@/server/repositories/popupRepository';
import type { PopupDTO } from '@/lib/dto/popup';

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

async function resolvePortals(input: PopupInput) {
  const norm = normalizeDistribution(input);
  const ids = await existingPortalIds(norm.portalIds);
  if (norm.distributionType !== 'all' && ids.length !== norm.portalIds.length) {
    return { ok: false as const, error: 'Alguno de los portales seleccionados no existe' };
  }
  return { ok: true as const, ids };
}

const LIVE = new Set(['active', 'scheduled']);

export async function createPopup(
  input: PopupInput,
  actor: Actor,
): Promise<ServiceResult<PopupDTO>> {
  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  const id = await repo.createPopup(input, portals.ids, actor.userId || null);
  const dto = await repo.getPopup(id);

  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'popups',
    entityType: 'popup',
    entityId: id,
    summary: `Creó el popup "${input.internalName}" (${input.status})`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (LIVE.has(input.status)) {
    queueRebuild('popup.create', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function updatePopup(
  id: string,
  input: PopupInput,
  actor: Actor,
): Promise<ServiceResult<PopupDTO>> {
  const existing = await repo.getPopupRow(id);
  if (!existing) return fail(404, 'Popup no encontrado');

  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  await repo.updatePopup(id, input, portals.ids);
  const dto = await repo.getPopup(id);

  await recordAudit({
    userId: actor.userId,
    action: 'update',
    module: 'popups',
    entityType: 'popup',
    entityId: id,
    summary: `Actualizó el popup "${input.internalName}" (${input.status})`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (LIVE.has(input.status) || LIVE.has(existing.status)) {
    queueRebuild('popup.update', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function deletePopup(
  id: string,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await repo.getPopupRow(id);
  if (!existing) return fail(404, 'Popup no encontrado');

  await repo.softDeletePopup(id);
  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'popups',
    entityType: 'popup',
    entityId: id,
    summary: `Eliminó el popup "${existing.internalName}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (LIVE.has(existing.status)) {
    queueRebuild('popup.delete', {
      distributionType: existing.distributionType,
      portalIds: [],
    });
  }
  return done({ id });
}
