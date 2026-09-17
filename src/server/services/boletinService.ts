import type { BoletinInput } from '@/lib/validations/boletin';
import { normalizeDistribution } from '@/lib/validations/distribution';
import { recordAudit } from '@/server/services/auditService';
import { queueRebuild } from '@/server/services/rebuildService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import { existingPortalIds } from '@/server/repositories/portalsSync';
import * as repo from '@/server/repositories/boletinRepository';
import type { BoletinDTO } from '@/lib/dto/boletin';

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

async function resolvePortals(
  input: BoletinInput,
): Promise<{ ok: true; ids: number[] } | { ok: false; error: string }> {
  const norm = normalizeDistribution(input);
  const ids = await existingPortalIds(norm.portalIds);
  if (norm.distributionType !== 'all' && ids.length !== norm.portalIds.length) {
    return { ok: false, error: 'Alguno de los portales seleccionados no existe' };
  }
  return { ok: true, ids };
}

export async function createBoletin(
  input: BoletinInput,
  actor: Actor,
): Promise<ServiceResult<BoletinDTO>> {
  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  const id = await repo.createBoletin(input, portals.ids, actor.userId || null);
  const dto = await repo.getBoletin(id);

  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'boletines',
    entityType: 'boletin',
    entityId: id,
    summary: `Creó el boletín "${input.title}"`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (input.status === 'published') {
    queueRebuild('boletin.create', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function updateBoletin(
  id: number,
  input: BoletinInput,
  actor: Actor,
): Promise<ServiceResult<BoletinDTO>> {
  const existing = await repo.getBoletinRow(id);
  if (!existing) return fail(404, 'Boletín no encontrado');

  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  await repo.updateBoletin(id, input, portals.ids);
  const dto = await repo.getBoletin(id);

  await recordAudit({
    userId: actor.userId,
    action: 'update',
    module: 'boletines',
    entityType: 'boletin',
    entityId: id,
    summary: `Actualizó el boletín "${input.title}"`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (input.status === 'published' || existing.status === 'published') {
    queueRebuild('boletin.update', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function deleteBoletin(
  id: number,
  actor: Actor,
): Promise<ServiceResult<{ id: number }>> {
  const existing = await repo.getBoletinRow(id);
  if (!existing) return fail(404, 'Boletín no encontrado');

  await repo.softDeleteBoletin(id);
  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'boletines',
    entityType: 'boletin',
    entityId: id,
    summary: `Eliminó el boletín "${existing.title}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (existing.status === 'published') {
    queueRebuild('boletin.delete', {
      distributionType: existing.distributionType,
      portalIds: [],
    });
  }
  return done({ id });
}
