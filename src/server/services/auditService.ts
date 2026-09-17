import { db } from '@/lib/db/client';
import { auditLogs } from '@/lib/db/schema';
import { logger } from '@/lib/logger';

export interface AuditInput {
  userId?: string | null;
  action: string;
  module: string;
  entityType?: string | null;
  entityId?: string | number | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Registra una entrada de auditoría (append-only, plan §29).
 * Nunca lanza: un fallo de auditoría no debe interrumpir la operación de negocio.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: input.userId ?? null,
      action: input.action,
      module: input.module,
      entityType: input.entityType ?? null,
      entityId: input.entityId != null ? String(input.entityId) : null,
      summary: input.summary,
      metadata: input.metadata ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    logger.error({ err, action: input.action }, 'no se pudo registrar la auditoría');
  }
}

/** Extrae la IP del cliente de las cabeceras habituales de proxy. */
export function clientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? null;
}
