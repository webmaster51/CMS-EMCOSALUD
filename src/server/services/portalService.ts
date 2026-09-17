import type { PortalInput, ApiKeyInput } from '@/lib/validations/portal';
import { generateApiKey } from '@/lib/api-keys';
import { recordAudit } from '@/server/services/auditService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import * as repo from '@/server/repositories/portalRepository';
import type { portals } from '@/lib/db/schema';

type Portal = typeof portals.$inferSelect;

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export async function createPortal(
  input: PortalInput,
  actor: Actor,
): Promise<ServiceResult<Portal>> {
  if (await repo.slugTaken(input.slug)) {
    return fail(409, 'El slug ya está en uso', { slug: 'Ya existe un portal con este slug' });
  }
  const portal = await repo.createPortal(input);
  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'portales',
    entityType: 'portal',
    entityId: portal.id,
    summary: `Creó el portal "${portal.name}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done(portal);
}

export async function updatePortal(
  id: number,
  input: PortalInput,
  actor: Actor,
): Promise<ServiceResult<Portal>> {
  const existing = await repo.getPortal(id);
  if (!existing) return fail(404, 'Portal no encontrado');
  if (await repo.slugTaken(input.slug, id)) {
    return fail(409, 'El slug ya está en uso', { slug: 'Ya existe un portal con este slug' });
  }
  const portal = await repo.updatePortal(id, input);
  if (!portal) return fail(404, 'Portal no encontrado');
  await recordAudit({
    userId: actor.userId,
    action: 'update',
    module: 'portales',
    entityType: 'portal',
    entityId: id,
    summary: `Actualizó el portal "${portal.name}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done(portal);
}

export async function deletePortal(
  id: number,
  actor: Actor,
): Promise<ServiceResult<{ id: number }>> {
  const existing = await repo.getPortal(id);
  if (!existing) return fail(404, 'Portal no encontrado');
  if (await repo.portalInUse(id)) {
    return fail(
      409,
      'El portal tiene contenidos o categorías asociados. Desactívalo en lugar de eliminarlo.',
    );
  }
  await repo.deletePortal(id);
  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'portales',
    entityType: 'portal',
    entityId: id,
    summary: `Eliminó el portal "${existing.name}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done({ id });
}

export async function createApiKey(
  portalId: number,
  input: ApiKeyInput,
  actor: Actor,
): Promise<ServiceResult<{ id: number; plaintext: string; prefix: string }>> {
  const portal = await repo.getPortal(portalId);
  if (!portal) return fail(404, 'Portal no encontrado');

  const key = generateApiKey(portal.slug);
  const id = await repo.insertApiKey({
    portalId,
    name: input.name,
    keyHash: key.hash,
    keyPrefix: key.prefix,
    createdBy: actor.userId,
  });
  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'portales',
    entityType: 'api_key',
    entityId: id,
    summary: `Generó una clave de API ("${input.name}") para el portal "${portal.name}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done({ id, plaintext: key.plaintext, prefix: key.prefix });
}

export async function revokeApiKey(
  portalId: number,
  keyId: number,
  actor: Actor,
): Promise<ServiceResult<{ id: number }>> {
  const revoked = await repo.revokeApiKey(portalId, keyId);
  if (!revoked) return fail(404, 'Clave no encontrada o ya revocada');
  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'portales',
    entityType: 'api_key',
    entityId: keyId,
    summary: `Revocó una clave de API del portal #${portalId}`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done({ id: keyId });
}
