import { and, eq } from 'drizzle-orm';
import { hash as argon2Hash } from '@node-rs/argon2';
import { db } from '@/lib/db/client';
import { accounts, sessions, users } from '@/lib/db/schema';
import { auth } from '@/server/auth/auth';
import { recordAudit } from '@/server/services/auditService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import * as repo from '@/server/repositories/userRepository';
import type {
  UserCreateInput,
  UserUpdateInput,
} from '@/lib/validations/user';
import type { UserDTO } from '@/lib/dto/user';

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export async function createUser(
  input: UserCreateInput,
  actor: Actor,
): Promise<ServiceResult<UserDTO>> {
  if (await repo.emailTaken(input.email)) {
    return fail(409, 'Ya existe un usuario con ese correo', { email: 'Correo en uso' });
  }
  try {
    await auth.api.signUpEmail({
      body: { email: input.email, password: input.password, name: input.name },
    });
  } catch {
    return fail(422, 'No se pudo crear el usuario (revisa el correo y la contraseña)');
  }
  const [row] = await db
    .update(users)
    .set({ role: input.role, emailVerified: true })
    .where(eq(users.email, input.email))
    .returning();

  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'usuarios',
    entityType: 'user',
    entityId: row!.id,
    summary: `Creó el usuario ${input.email} (${input.role})`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done((await repo.getUser(row!.id))!);
}

export async function updateUser(
  id: string,
  input: UserUpdateInput,
  actor: Actor,
): Promise<ServiceResult<UserDTO>> {
  const existing = await repo.getUserRow(id);
  if (!existing) return fail(404, 'Usuario no encontrado');

  if (id === actor.userId && (input.role !== 'superadmin' || input.status !== 'active')) {
    return fail(422, 'No puedes quitarte a ti mismo el rol de superadministrador ni suspenderte');
  }
  if (
    existing.role === 'superadmin' &&
    (input.role !== 'superadmin' || input.status !== 'active') &&
    (await repo.countSuperadmins(id)) === 0
  ) {
    return fail(422, 'Debe quedar al menos un superadministrador activo');
  }

  const updated = await repo.updateUserFields(id, input);
  if (!updated) return fail(404, 'Usuario no encontrado');

  // Si se suspende, cerrar sus sesiones.
  if (input.status === 'suspended' && existing.status !== 'suspended') {
    await db.delete(sessions).where(eq(sessions.userId, id));
  }

  await recordAudit({
    userId: actor.userId,
    action: 'update',
    module: 'usuarios',
    entityType: 'user',
    entityId: id,
    summary: `Actualizó el usuario ${existing.email} (rol ${input.role}, ${input.status})`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done(updated);
}

export async function resetUserPassword(
  id: string,
  newPassword: string,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await repo.getUserRow(id);
  if (!existing) return fail(404, 'Usuario no encontrado');

  const pwHash = await argon2Hash(newPassword, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const updated = await db
    .update(accounts)
    .set({ password: pwHash, updatedAt: new Date() })
    .where(and(eq(accounts.userId, id), eq(accounts.providerId, 'credential')))
    .returning({ id: accounts.id });
  if (updated.length === 0) return fail(422, 'El usuario no tiene contraseña configurada');

  await db.delete(sessions).where(eq(sessions.userId, id));

  await recordAudit({
    userId: actor.userId,
    action: 'password_reset',
    module: 'usuarios',
    entityType: 'user',
    entityId: id,
    summary: `Restableció la contraseña de ${existing.email}`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done({ id });
}

export async function deleteUser(
  id: string,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await repo.getUserRow(id);
  if (!existing) return fail(404, 'Usuario no encontrado');
  if (id === actor.userId) return fail(422, 'No puedes eliminar tu propia cuenta');
  if (existing.role === 'superadmin' && (await repo.countSuperadmins(id)) === 0) {
    return fail(422, 'Debe quedar al menos un superadministrador');
  }

  await repo.deleteUser(id);
  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'usuarios',
    entityType: 'user',
    entityId: id,
    summary: `Eliminó el usuario ${existing.email}`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done({ id });
}
