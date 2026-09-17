import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { media } from '@/lib/db/schema';
import { deleteObject } from '@/lib/storage/s3';
import { recordAudit } from '@/server/services/auditService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import * as repo from '@/server/repositories/certificateRepository';
import type { CertificateInput } from '@/lib/validations/certificate';
import type { CertificateDTO } from '@/lib/dto/certificate';

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export async function createCertificate(
  input: CertificateInput,
  actor: Actor,
): Promise<ServiceResult<CertificateDTO>> {
  if (await repo.keyExists(input.companyId, input.taxYear, input.documentNumber)) {
    return fail(409, 'Ya existe un certificado para esa empresa, año y documento', {
      documentNumber: 'Ya registrado para ese año',
    });
  }

  // Crea el registro pasando todo el 'input' (incluyendo fullName y pdfName si vienen definidos)
  const row = await repo.createCertificate(input, actor.userId || null);

  // Formatea el resumen de auditoría priorizando fullName si está disponible
  const label = input.fullName ? `${input.fullName} (${row.documentNumber})` : row.documentNumber;

  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'certificados',
    entityType: 'certificate',
    entityId: row.id,
    summary: `Creó el certificado ${label} [${row.taxYear}]`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });

  return done((await repo.getCertificate(row.id))!);
}

export async function updateCertificate(
  id: number,
  input: CertificateInput,
  actor: Actor,
): Promise<ServiceResult<CertificateDTO>> {
  const existing = await repo.getCertificateRow(id);
  if (!existing) return fail(404, 'Certificado no encontrado');

  if (await repo.keyExists(input.companyId, input.taxYear, input.documentNumber, id)) {
    return fail(409, 'Ya existe un certificado para esa empresa, año y documento', {
      documentNumber: 'Ya registrado para ese año',
    });
  }

  const row = await repo.updateCertificate(id, input);
  if (!row) return fail(404, 'Certificado no encontrado');

  // Si cambió el PDF asociado, se limpia el medio anterior de S3/R2
  if (existing.pdfMediaId !== input.pdfMediaId) {
    await removeMedia(existing.pdfMediaId);
  }

  const label = input.fullName ? `${input.fullName} (${row.documentNumber})` : row.documentNumber;

  await recordAudit({
    userId: actor.userId,
    action: 'update',
    module: 'certificados',
    entityType: 'certificate',
    entityId: id,
    summary: `Actualizó el certificado ${label} [${row.taxYear}]`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });

  return done((await repo.getCertificate(id))!);
}

export async function deleteCertificate(
  id: number,
  actor: Actor,
): Promise<ServiceResult<{ id: number }>> {
  const existing = await repo.getCertificateRow(id);
  if (!existing) return fail(404, 'Certificado no encontrado');

  await repo.deleteCertificate(id);
  await removeMedia(existing.pdfMediaId);

  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'certificados',
    entityType: 'certificate',
    entityId: id,
    summary: `Eliminó el certificado ${existing.documentNumber} (${existing.taxYear})`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });

  return done({ id });
}

/** Borra la fila de media y el objeto de storage de un PDF de certificado. */
export async function removeMedia(mediaId: string | null): Promise<void> {
  if (!mediaId) return;
  const [row] = await db
    .select({ storageKey: media.storageKey })
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);

  await db.delete(media).where(eq(media.id, mediaId));
  if (row) await deleteObject(row.storageKey).catch(() => undefined);
}