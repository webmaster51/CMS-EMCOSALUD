import type { TrainingInput } from '@/lib/validations/training';
import { normalizeDistribution } from '@/lib/validations/distribution';
import { recordAudit } from '@/server/services/auditService';
import { queueRebuild } from '@/server/services/rebuildService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import { existingPortalIds } from '@/server/repositories/portalsSync';
import * as repo from '@/server/repositories/trainingRepository';
import type { TrainingDTO } from '@/lib/dto/training';

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

async function resolvePortals(input: TrainingInput) {
  const norm = normalizeDistribution(input);
  const ids = await existingPortalIds(norm.portalIds);
  if (norm.distributionType !== 'all' && ids.length !== norm.portalIds.length) {
    return { ok: false as const, error: 'Alguno de los portales seleccionados no existe' };
  }
  return { ok: true as const, ids };
}

export async function createTraining(
  input: TrainingInput,
  actor: Actor,
): Promise<ServiceResult<TrainingDTO>> {
  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  const id = await repo.createTraining(input, portals.ids, actor.userId || null);
  const dto = await repo.getTraining(id);

  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'capacitaciones',
    entityType: 'training_material',
    entityId: id,
    summary: `Creó la capacitación "${input.title}"`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (input.status === 'published') {
    queueRebuild('training.create', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function updateTraining(
  id: number,
  input: TrainingInput,
  actor: Actor,
): Promise<ServiceResult<TrainingDTO>> {
  const existing = await repo.getTrainingRow(id);
  if (!existing) return fail(404, 'Capacitación no encontrada');

  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  await repo.updateTraining(id, input, portals.ids);
  const dto = await repo.getTraining(id);

  await recordAudit({
    userId: actor.userId,
    action: 'update',
    module: 'capacitaciones',
    entityType: 'training_material',
    entityId: id,
    summary: `Actualizó la capacitación "${input.title}"`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (input.status === 'published' || existing.status === 'published') {
    queueRebuild('training.update', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function deleteTraining(
  id: number,
  actor: Actor,
): Promise<ServiceResult<{ id: number }>> {
  const existing = await repo.getTrainingRow(id);
  if (!existing) return fail(404, 'Capacitación no encontrada');

  await repo.softDeleteTraining(id);
  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'capacitaciones',
    entityType: 'training_material',
    entityId: id,
    summary: `Eliminó la capacitación "${existing.title}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (existing.status === 'published') {
    queueRebuild('training.delete', {
      distributionType: existing.distributionType,
      portalIds: [],
    });
  }
  return done({ id });
}
