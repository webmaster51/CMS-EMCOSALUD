import type { BoardPublicationInput } from '@/lib/validations/boardPublication';
import { normalizeDistribution } from '@/lib/validations/distribution';
import { recordAudit } from '@/server/services/auditService';
import { queueRebuild } from '@/server/services/rebuildService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import { existingPortalIds } from '@/server/repositories/portalsSync';
import * as repo from '@/server/repositories/boardPublicationRepository';
import type { BoardPublicationDTO } from '@/lib/dto/boardPublication';

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

async function resolvePortals(input: BoardPublicationInput) {
  const norm = normalizeDistribution(input);
  const ids = await existingPortalIds(norm.portalIds);
  if (norm.distributionType !== 'all' && ids.length !== norm.portalIds.length) {
    return { ok: false as const, error: 'Alguno de los portales seleccionados no existe' };
  }
  return { ok: true as const, ids };
}

export async function createBoardPublication(
  input: BoardPublicationInput,
  actor: Actor,
): Promise<ServiceResult<BoardPublicationDTO>> {
  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  const id = await repo.createBoardPublication(input, portals.ids, actor.userId || null);
  const dto = await repo.getBoardPublication(id);

  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'publicaciones',
    entityType: 'board_publication',
    entityId: id,
    summary: `Creó la publicación de cartelera "${input.title}"`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (input.status === 'published') {
    queueRebuild('board_publication.create', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function updateBoardPublication(
  id: number,
  input: BoardPublicationInput,
  actor: Actor,
): Promise<ServiceResult<BoardPublicationDTO>> {
  const existing = await repo.getBoardPublicationRow(id);
  if (!existing) return fail(404, 'Publicación no encontrada');

  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  await repo.updateBoardPublication(id, input, portals.ids);
  const dto = await repo.getBoardPublication(id);

  await recordAudit({
    userId: actor.userId,
    action: 'update',
    module: 'publicaciones',
    entityType: 'board_publication',
    entityId: id,
    summary: `Actualizó la publicación de cartelera "${input.title}"`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (input.status === 'published' || existing.status === 'published') {
    queueRebuild('board_publication.update', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function deleteBoardPublication(
  id: number,
  actor: Actor,
): Promise<ServiceResult<{ id: number }>> {
  const existing = await repo.getBoardPublicationRow(id);
  if (!existing) return fail(404, 'Publicación no encontrada');

  await repo.softDeleteBoardPublication(id);
  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'publicaciones',
    entityType: 'board_publication',
    entityId: id,
    summary: `Eliminó la publicación de cartelera "${existing.title}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (existing.status === 'published') {
    queueRebuild('board_publication.delete', {
      distributionType: existing.distributionType,
      portalIds: [],
    });
  }
  return done({ id });
}
