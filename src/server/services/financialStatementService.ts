import type { FinancialStatementInput } from '@/lib/validations/financialStatement';
import { normalizeDistribution } from '@/lib/validations/distribution';
import { recordAudit } from '@/server/services/auditService';
import { queueRebuild } from '@/server/services/rebuildService';
import { removeMedia } from '@/server/services/certificateService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import { existingPortalIds } from '@/server/repositories/portalsSync';
import { getCompany } from '@/server/repositories/companyRepository';
import * as repo from '@/server/repositories/financialStatementRepository';
import type { FinancialStatementDTO } from '@/lib/dto/financialStatement';

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

async function resolvePortals(input: FinancialStatementInput) {
  const norm = normalizeDistribution(input);
  const ids = await existingPortalIds(norm.portalIds);
  if (norm.distributionType !== 'all' && ids.length !== norm.portalIds.length) {
    return { ok: false as const, error: 'Alguno de los portales seleccionados no existe' };
  }
  return { ok: true as const, ids };
}

const DUPLICATE = 'Ya existe una publicación de estados financieros para esa empresa y ese año';
const LIVE = new Set(['published']);

/** Borra del storage los documentos que ya no estén referenciados. */
async function pruneOrphanFiles(previousMediaIds: string[], keptMediaIds: string[]): Promise<void> {
  const kept = new Set(keptMediaIds);
  for (const mediaId of previousMediaIds) {
    if (!kept.has(mediaId)) await removeMedia(mediaId);
  }
}

export async function createFinancialStatement(
  input: FinancialStatementInput,
  actor: Actor,
): Promise<ServiceResult<FinancialStatementDTO>> {
  const company = await getCompany(input.companyId);
  if (!company) return fail(422, 'La empresa seleccionada no existe', { companyId: 'No existe' });
  if (await repo.keyExists(input.companyId, input.fiscalYear)) {
    return fail(409, DUPLICATE, { fiscalYear: 'Ya registrado para esa empresa' });
  }

  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  const id = await repo.create(input, portals.ids, actor.userId || null);
  const dto = await repo.get(id);

  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'estados-financieros',
    entityType: 'financial_statement',
    entityId: id,
    summary: `Publicó los estados financieros de ${company.shortName} ${input.fiscalYear} (${input.status})`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (LIVE.has(input.status)) {
    queueRebuild('financial_statement.create', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function updateFinancialStatement(
  id: number,
  input: FinancialStatementInput,
  actor: Actor,
): Promise<ServiceResult<FinancialStatementDTO>> {
  const existing = await repo.getRow(id);
  if (!existing) return fail(404, 'Estados financieros no encontrados');
  const company = await getCompany(input.companyId);
  if (!company) return fail(422, 'La empresa seleccionada no existe', { companyId: 'No existe' });
  if (await repo.keyExists(input.companyId, input.fiscalYear, id)) {
    return fail(409, DUPLICATE, { fiscalYear: 'Ya registrado para esa empresa' });
  }

  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  const previousMediaIds = await repo.fileMediaIds(id);
  await repo.update(id, input, portals.ids);
  await pruneOrphanFiles(
    previousMediaIds,
    input.files.map((f) => f.mediaId),
  );
  const dto = await repo.get(id);

  await recordAudit({
    userId: actor.userId,
    action: 'update',
    module: 'estados-financieros',
    entityType: 'financial_statement',
    entityId: id,
    summary: `Actualizó los estados financieros de ${company.shortName} ${input.fiscalYear} (${input.status})`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (LIVE.has(input.status) || LIVE.has(existing.status)) {
    queueRebuild('financial_statement.update', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function deleteFinancialStatement(
  id: number,
  actor: Actor,
): Promise<ServiceResult<{ id: number }>> {
  const existing = await repo.getRow(id);
  if (!existing) return fail(404, 'Estados financieros no encontrados');

  const mediaIds = await repo.fileMediaIds(id);
  await repo.softDelete(id);
  for (const mediaId of mediaIds) await removeMedia(mediaId);

  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'estados-financieros',
    entityType: 'financial_statement',
    entityId: id,
    summary: `Eliminó los estados financieros del año ${existing.fiscalYear}`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (LIVE.has(existing.status)) {
    queueRebuild('financial_statement.delete', {
      distributionType: existing.distributionType,
      portalIds: [],
    });
  }
  return done({ id });
}
