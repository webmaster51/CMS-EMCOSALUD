import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import type { UserDTO } from '@/lib/dto/user';
import type { Paginated } from '@/lib/validations/common';
import type { userListSchema } from '@/lib/validations/user';
import type { z } from 'zod';

type ListParams = z.infer<typeof userListSchema>;

function toDTO(row: typeof users.$inferSelect): UserDTO {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUsersPaged(params: ListParams): Promise<Paginated<UserDTO>> {
  const filters = [];
  if (params.role) filters.push(eq(users.role, params.role));
  if (params.status) filters.push(eq(users.status, params.status));
  if (params.q) {
    const like = or(ilike(users.name, `%${params.q}%`), ilike(users.email, `%${params.q}%`));
    if (like) filters.push(like);
  }
  const where = filters.length ? and(...filters) : undefined;
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(users).where(where),
  ]);
  const total = totalRow?.n ?? 0;
  return {
    data: rows.map(toDTO),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getUser(id: string): Promise<UserDTO | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toDTO(row) : undefined;
}

export async function getUserRow(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function emailTaken(email: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return Boolean(row);
}

export async function updateUserFields(
  id: string,
  patch: { name?: string; role?: 'superadmin' | 'editor'; status?: 'active' | 'suspended' },
): Promise<UserDTO | undefined> {
  const [row] = await db
    .update(users)
    .set({
      ...patch,
      ...(patch.status ? { banned: patch.status === 'suspended' } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
  return row ? toDTO(row) : undefined;
}

export async function countSuperadmins(exceptId?: string): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'superadmin'), eq(users.status, 'active')));
  return rows.filter((r) => r.id !== exceptId).length;
}

export async function deleteUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}
