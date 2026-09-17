import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { publishDueScheduledPosts } from '@/server/repositories/blogRepository';
import { advancePopupStates } from '@/server/repositories/popupRepository';
import { advanceBannerStates } from '@/server/repositories/bannerRepository';
import { getDashboard } from '@/server/services/dashboardService';
import { queueRebuild } from '@/server/services/rebuildService';
import { recordAudit } from '@/server/services/auditService';
import { resumeStuckJobs } from '@/server/services/bulkUploadService';

/**
 * Planificador ligero en proceso: publica el contenido programado cuya fecha ya
 * pasó (artículos del blog; en la Fase 13 se añaden los popups).
 *
 * Corre cada minuto en el proceso del servidor. En la Fase 14 esta lógica pasará
 * a un job recurrente de pg-boss (más robusto ante múltiples instancias).
 */
const TICK_MS = 60_000;

const globalForScheduler = globalThis as unknown as { __cmsScheduler?: boolean };

async function tick(): Promise<void> {
  try {
    const publishedIds = await publishDueScheduledPosts();
    if (publishedIds.length > 0) {
      logger.info({ count: publishedIds.length }, 'artículos programados publicados');
      for (const id of publishedIds) {
        await recordAudit({
          action: 'publish_scheduled',
          module: 'blog',
          entityType: 'blog_post',
          entityId: id,
          summary: 'Se publicó un artículo programado',
        });
      }
      queueRebuild('blog.scheduled', { distributionType: 'unknown', portalIds: [] });
    }

    const popups = await advancePopupStates();
    if (popups.activated > 0 || popups.finished > 0) {
      logger.info(popups, 'popups: transición de estado por fecha');
      queueRebuild('popup.scheduled', { distributionType: 'unknown', portalIds: [] });
    }

    const bannerStates = await advanceBannerStates();
    if (bannerStates.activated > 0 || bannerStates.finished > 0) {
      logger.info(bannerStates, 'banners: transición de estado por fecha');
      queueRebuild('banner.scheduled', { distributionType: 'unknown', portalIds: [] });
    }

    // Refresca la caché del dashboard.
    await getDashboard(null, { refresh: true });
  } catch (err) {
    logger.error({ err }, 'fallo del planificador');
  }
}

export function startScheduler(): void {
  if (globalForScheduler.__cmsScheduler) return;
  globalForScheduler.__cmsScheduler = true;
  if (getEnv().NODE_ENV === 'test') return;

  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  // Primer ciclo poco después de arrancar.
  setTimeout(() => void tick(), 5_000).unref?.();
  // Reanuda cargas masivas que quedaron a medias.
  setTimeout(() => void resumeStuckJobs(), 8_000).unref?.();
  logger.info('planificador de contenido iniciado');
}
