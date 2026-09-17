import type { CompanyInput } from '@/lib/validations/company';
import { recordAudit } from '@/server/services/auditService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import * as repo from '@/server/repositories/companyRepository';
import type { companies } from '@/lib/db/schema';

type Company = typeof companies.$inferSelect;

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export async function createCompany(
  input: CompanyInput,
  actor: Actor,
): Promise<ServiceResult<Company>> {
  if (await repo.taxIdTaken(input.taxId)) {
    return fail(409, 'El NIT ya está registrado', { taxId: 'Ya existe una empresa con este NIT' });
  }
  const company = await repo.createCompany(input);
  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'empresas',
    entityType: 'company',
    entityId: company.id,
    summary: `Creó la empresa "${company.name}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done(company);
}

export async function updateCompany(
  id: number,
  input: CompanyInput,
  actor: Actor,
): Promise<ServiceResult<Company>> {
  const existing = await repo.getCompany(id);
  if (!existing) return fail(404, 'Empresa no encontrada');
  if (await repo.taxIdTaken(input.taxId, id)) {
    return fail(409, 'El NIT ya está registrado', { taxId: 'Ya existe una empresa con este NIT' });
  }
  const company = await repo.updateCompany(id, input);
  if (!company) return fail(404, 'Empresa no encontrada');
  await recordAudit({
    userId: actor.userId,
    action: 'update',
    module: 'empresas',
    entityType: 'company',
    entityId: id,
    summary: `Actualizó la empresa "${company.name}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done(company);
}

export async function deleteCompany(
  id: number,
  actor: Actor,
): Promise<ServiceResult<{ id: number }>> {
  const existing = await repo.getCompany(id);
  if (!existing) return fail(404, 'Empresa no encontrada');
  if (await repo.companyInUse(id)) {
    return fail(
      409,
      'La empresa tiene certificados o cargas asociadas. Desactívala en lugar de eliminarla.',
    );
  }
  await repo.deleteCompany(id);
  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'empresas',
    entityType: 'company',
    entityId: id,
    summary: `Eliminó la empresa "${existing.name}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done({ id });
}
