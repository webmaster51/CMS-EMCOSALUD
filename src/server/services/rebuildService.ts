import { inArray, isNotNull, ne, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { portals } from '@/lib/db/schema';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { recordAudit } from '@/server/services/auditService';

/**
 * Dispara los deploy hooks de los portales afectados por un cambio de contenido
 * (plan §9.3). Debounce por portal y reintentos con backoff.
 *
 * En la Fase 14 este es el mecanismo definitivo (proceso único). Con varias
 * instancias convendría moverlo a pg-boss; el contrato de `queueRebuild` no cambia.
 */
interface Scope {
  distributionType: string;
  portalIds: number[];
}

const pending = new Map<number, ReturnType<typeof setTimeout>>();

export function queueRebuild(reason: string, scope: Scope): void {
  void resolveTargets(scope)
    .then((targets) => {
      for (const target of targets) scheduleHook(target.id, target.url, reason);
    })
    .catch((err) => logger.error({ err, reason }, 'no se pudieron resolver los portales a reconstruir'));
}

async function resolveTargets(
  scope: Scope,
): Promise<{ id: number; url: string }[]> {
  const rows = await db
    .select({ id: portals.id, url: portals.deployHookUrl })
    .from(portals)
    .where(
      and(
        isNotNull(portals.deployHookUrl),
        ne(portals.status, 'inactive'),
        scope.distributionType === 'all' ||
          scope.distributionType === 'unknown' ||
          scope.portalIds.length === 0
          ? undefined
          : inArray(portals.id, scope.portalIds),
      ),
    );
  return rows.filter((r): r is { id: number; url: string } => Boolean(r.url));
}

function scheduleHook(portalId: number, url: string, reason: string): void {
  const existing = pending.get(portalId);
  if (existing) clearTimeout(existing);
  const delayMs = getEnv().WEBHOOK_DEBOUNCE_SECONDS * 1000;
  const timer = setTimeout(() => {
    pending.delete(portalId);
    void fireHook(portalId, url, reason);
  }, delayMs);
  timer.unref?.();
  pending.set(portalId, timer);
}

async function fireHook(portalId: number, url: string, reason: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'emcosalud-cms', reason }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        logger.info({ portalId, reason, status: res.status }, 'deploy hook disparado');
        await recordAudit({
          action: 'rebuild',
          module: 'sistema',
          entityType: 'portal',
          entityId: portalId,
          summary: `Se disparó la reconstrucción del portal #${portalId} (${reason})`,
        });
        return;
      }
      logger.warn({ portalId, status: res.status, attempt }, 'deploy hook respondió con error');
    } catch (err) {
      logger.warn({ err, portalId, attempt }, 'fallo al disparar el deploy hook');
    }
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
  logger.error({ portalId, reason }, 'deploy hook falló tras 3 intentos');
}
