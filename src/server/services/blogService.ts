import type { BlogInput } from '@/lib/validations/blog';
import { normalizeDistribution } from '@/lib/validations/distribution';
import { recordAudit } from '@/server/services/auditService';
import { queueRebuild } from '@/server/services/rebuildService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import { existingPortalIds } from '@/server/repositories/portalsSync';
import * as repo from '@/server/repositories/blogRepository';
import type { BlogPostDTO } from '@/lib/dto/blog';

interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

async function resolvePortals(input: BlogInput) {
  const norm = normalizeDistribution(input);
  const ids = await existingPortalIds(norm.portalIds);
  if (norm.distributionType !== 'all' && ids.length !== norm.portalIds.length) {
    return { ok: false as const, error: 'Alguno de los portales seleccionados no existe' };
  }
  return { ok: true as const, ids };
}

function isLive(status: BlogInput['status']): boolean {
  return status === 'published' || status === 'scheduled';
}

export async function createBlogPost(
  input: BlogInput,
  actor: Actor,
): Promise<ServiceResult<BlogPostDTO>> {
  if (await repo.slugTaken(input.slug)) {
    return fail(409, 'El slug ya está en uso', { slug: 'Ya existe un artículo con este slug' });
  }
  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  const id = await repo.createBlogPost(input, portals.ids, actor.userId || null);
  const dto = await repo.getBlogPost(id);

  await recordAudit({
    userId: actor.userId,
    action: 'create',
    module: 'blog',
    entityType: 'blog_post',
    entityId: id,
    summary: `Creó el artículo "${input.title}" (${input.status})`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (input.status === 'published') {
    queueRebuild('blog.create', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function updateBlogPost(
  id: string,
  input: BlogInput,
  actor: Actor,
): Promise<ServiceResult<BlogPostDTO>> {
  const existing = await repo.getBlogRow(id);
  if (!existing) return fail(404, 'Artículo no encontrado');
  if (await repo.slugTaken(input.slug, id)) {
    return fail(409, 'El slug ya está en uso', { slug: 'Ya existe un artículo con este slug' });
  }
  const portals = await resolvePortals(input);
  if (!portals.ok) return fail(422, portals.error, { portalIds: portals.error });

  await repo.updateBlogPost(id, input, portals.ids, existing.publishedAt);
  const dto = await repo.getBlogPost(id);

  await recordAudit({
    userId: actor.userId,
    action: 'update',
    module: 'blog',
    entityType: 'blog_post',
    entityId: id,
    summary: `Actualizó el artículo "${input.title}" (${input.status})`,
    metadata: { distributionType: input.distributionType, portalIds: portals.ids },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (isLive(input.status) || existing.status === 'published') {
    queueRebuild('blog.update', {
      distributionType: input.distributionType,
      portalIds: portals.ids,
    });
  }
  return done(dto!);
}

export async function deleteBlogPost(
  id: string,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await repo.getBlogRow(id);
  if (!existing) return fail(404, 'Artículo no encontrado');

  await repo.softDeleteBlogPost(id);
  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'blog',
    entityType: 'blog_post',
    entityId: id,
    summary: `Eliminó el artículo "${existing.title}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (existing.status === 'published') {
    queueRebuild('blog.delete', {
      distributionType: existing.distributionType,
      portalIds: [],
    });
  }
  return done({ id });
}
