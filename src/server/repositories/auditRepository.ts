import { and, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { auditLogs, users } from '@/lib/db/schema';
import type { Paginated } from '@/lib/validations/common';
import type { AuditListParams } from '@/lib/validations/audit';

export interface AuditEntryDTO {
  id: number;
  action: string;
  module: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: unknown;
  ip: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}

export async function listAuditPaged(
  params: AuditListParams,
): Promise<Paginated<AuditEntryDTO>> {
  const filters: SQL[] = [];
  if (params.module) filters.push(eq(auditLogs.module, params.module));
  if (params.action) filters.push(eq(auditLogs.action, params.action));
  if (params.userId) filters.push(eq(auditLogs.userId, params.userId));
  if (params.entityType) filters.push(eq(auditLogs.entityType, params.entityType));
  if (params.from) {
    const d = new Date(params.from);
    if (!Number.isNaN(d.getTime())) filters.push(gte(auditLogs.createdAt, d));
  }
  if (params.to) {
    const d = new Date(params.to);
    if (!Number.isNaN(d.getTime())) filters.push(lte(auditLogs.createdAt, d));
  }
  const where = filters.length ? and(...filters) : undefined;
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        module: auditLogs.module,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        summary: auditLogs.summary,
        metadata: auditLogs.metadata,
        ip: auditLogs.ip,
        userId: auditLogs.userId,
        userName: users.name,
        userEmail: users.email,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(auditLogs).where(where),
  ]);

  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

/** Valores distintos de módulo y acción para poblar los filtros. */
export async function auditFacets(): Promise<{ modules: string[]; actions: string[] }> {
  const [mods, acts] = await Promise.all([
    db.selectDistinct({ v: auditLogs.module }).from(auditLogs).orderBy(auditLogs.module),
    db.selectDistinct({ v: auditLogs.action }).from(auditLogs).orderBy(auditLogs.action),
  ]);
  return { modules: mods.map((m) => m.v), actions: acts.map((a) => a.v) };
}
