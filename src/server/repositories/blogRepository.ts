import {
  and,
  count,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db/client';
import {
  blogPostPortals,
  blogPostTags,
  blogPosts,
  categories,
  media,
  portals,
  tags,
  users,
} from '@/lib/db/schema';
import { mediaUrl } from '@/server/repositories/portalRepository';
import {
  portalVisibilityCondition,
  syncContentPortals,
} from '@/server/repositories/portalsSync';
import { resolveTagIds, syncPostTags } from '@/server/repositories/tagRepository';
import { sanitizeBlogHtml } from '@/lib/html-sanitize';
import type { BlogPostDTO, PortalRef } from '@/lib/dto/blog';
import type { BlogInput } from '@/lib/validations/blog';
import type { Paginated, PaginationParams } from '@/lib/validations/common';

const featM = alias(media, 'feat_m');
const ogM = alias(media, 'og_m');

interface ListParams extends PaginationParams {
  status?: BlogPostDTO['status'];
  categoryId?: number;
  portalId?: number;
  tagSlug?: string;
  since?: Date;
}

const baseColumns = {
  post: blogPosts,
  categoryName: categories.name,
  featThumb: featM.thumbnailKey,
  featKey: featM.storageKey,
  ogThumb: ogM.thumbnailKey,
  ogKey: ogM.storageKey,
  authorName: users.name,
};

type BaseRow = {
  post: typeof blogPosts.$inferSelect;
  categoryName: string | null;
  featThumb: string | null;
  featKey: string | null;
  ogThumb: string | null;
  ogKey: string | null;
  authorName: string | null;
};

function rowToDTO(r: BaseRow, portalRefs: PortalRef[], tagNames: string[]): BlogPostDTO {
  const p = r.post;
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    contentHtml: p.contentHtml,
    contentJson: p.contentJson,
    status: p.status,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
    distributionType: p.distributionType,
    portals: portalRefs,
    categoryId: p.categoryId,
    categoryName: r.categoryName,
    tags: tagNames,
    featuredMediaId: p.featuredMediaId,
    featuredUrl: mediaUrl(r.featThumb, r.featKey),
    ogMediaId: p.ogMediaId,
    ogUrl: mediaUrl(r.ogThumb, r.ogKey),
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    authorName: r.authorName,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

async function auxFor(ids: string[]): Promise<{
  portals: Map<string, PortalRef[]>;
  tags: Map<string, string[]>;
}> {
  const portalMap = new Map<string, PortalRef[]>();
  const tagMap = new Map<string, string[]>();
  if (ids.length === 0) return { portals: portalMap, tags: tagMap };

  const [portalRows, tagRows] = await Promise.all([
    db
      .select({
        postId: blogPostPortals.blogPostId,
        id: portals.id,
        name: portals.name,
        slug: portals.slug,
      })
      .from(blogPostPortals)
      .innerJoin(portals, eq(portals.id, blogPostPortals.portalId))
      .where(inArray(blogPostPortals.blogPostId, ids)),
    db
      .select({ postId: blogPostTags.blogPostId, name: tags.name })
      .from(blogPostTags)
      .innerJoin(tags, eq(tags.id, blogPostTags.tagId))
      .where(inArray(blogPostTags.blogPostId, ids)),
  ]);

  for (const row of portalRows) {
    const list = portalMap.get(row.postId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    portalMap.set(row.postId, list);
  }
  for (const row of tagRows) {
    const list = tagMap.get(row.postId) ?? [];
    list.push(row.name);
    tagMap.set(row.postId, list);
  }
  return { portals: portalMap, tags: tagMap };
}

export async function listBlogPaged(params: ListParams): Promise<Paginated<BlogPostDTO>> {
  const filters: SQL[] = [isNull(blogPosts.deletedAt)];
  if (params.status) filters.push(eq(blogPosts.status, params.status));
  if (params.categoryId) filters.push(eq(blogPosts.categoryId, params.categoryId));
  if (params.since) filters.push(gte(blogPosts.publishedAt, params.since));
  if (params.tagSlug) {
    const tagSlug = params.tagSlug;
    filters.push(
      exists(
        db
          .select({ x: blogPostTags.tagId })
          .from(blogPostTags)
          .innerJoin(tags, eq(tags.id, blogPostTags.tagId))
          .where(and(eq(blogPostTags.blogPostId, blogPosts.id), eq(tags.slug, tagSlug))),
      ),
    );
  }
  if (params.q) {
    const like = or(
      ilike(blogPosts.title, `%${params.q}%`),
      ilike(blogPosts.slug, `%${params.q}%`),
      ilike(blogPosts.excerpt, `%${params.q}%`),
    );
    if (like) filters.push(like);
  }
  if (params.portalId) {
    filters.push(
      portalVisibilityCondition(
        blogPosts.distributionType,
        blogPosts.id,
        blogPostPortals,
        blogPostPortals.blogPostId,
        blogPostPortals.portalId,
        params.portalId,
      ),
    );
  }
  const where = and(...filters);
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(baseColumns)
      .from(blogPosts)
      .leftJoin(categories, eq(categories.id, blogPosts.categoryId))
      .leftJoin(featM, eq(featM.id, blogPosts.featuredMediaId))
      .leftJoin(ogM, eq(ogM.id, blogPosts.ogMediaId))
      .leftJoin(users, eq(users.id, blogPosts.authorId))
      .where(where)
      .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(blogPosts).where(where),
  ]);

  const ids = rows.map((r) => r.post.id);
  const aux = await auxFor(ids);
  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) =>
      rowToDTO(r, aux.portals.get(r.post.id) ?? [], aux.tags.get(r.post.id) ?? []),
    ),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getBlogPost(id: string): Promise<BlogPostDTO | undefined> {
  const [row] = await db
    .select(baseColumns)
    .from(blogPosts)
    .leftJoin(categories, eq(categories.id, blogPosts.categoryId))
    .leftJoin(featM, eq(featM.id, blogPosts.featuredMediaId))
    .leftJoin(ogM, eq(ogM.id, blogPosts.ogMediaId))
    .leftJoin(users, eq(users.id, blogPosts.authorId))
    .where(and(eq(blogPosts.id, id), isNull(blogPosts.deletedAt)))
    .limit(1);
  if (!row) return undefined;
  const aux = await auxFor([id]);
  return rowToDTO(row, aux.portals.get(id) ?? [], aux.tags.get(id) ?? []);
}

export async function getBlogRow(id: string) {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.id, id), isNull(blogPosts.deletedAt)))
    .limit(1);
  return row;
}

export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);
  return Boolean(row) && row!.id !== exceptId;
}

function computedDates(input: BlogInput, prevPublishedAt: Date | null) {
  const scheduledAt =
    input.status === 'scheduled' && input.scheduleAt ? new Date(input.scheduleAt) : null;
  let publishedAt: Date | null = prevPublishedAt;
  if (input.status === 'published') {
    publishedAt = input.publishDate ? new Date(input.publishDate) : (prevPublishedAt ?? new Date());
  } else if (input.status === 'draft' || input.status === 'scheduled') {
    publishedAt = input.publishDate ? new Date(input.publishDate) : prevPublishedAt;
  }
  return { scheduledAt, publishedAt };
}

function contentColumns(input: BlogInput) {
  return {
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt ? input.excerpt : null,
    contentHtml: input.contentHtml ? sanitizeBlogHtml(input.contentHtml) : null,
    contentJson: input.contentJson ?? null,
    featuredMediaId: input.featuredMediaId ?? null,
    ogMediaId: input.ogMediaId ?? null,
    categoryId: input.categoryId ?? null,
    status: input.status,
    metaTitle: input.metaTitle ? input.metaTitle : null,
    metaDescription: input.metaDescription ? input.metaDescription : null,
    distributionType: input.distributionType,
  };
}

export async function createBlogPost(
  input: BlogInput,
  portalIds: number[],
  authorId: string | null,
): Promise<string> {
  return db.transaction(async (tx) => {
    const dates = computedDates(input, null);
    const [row] = await tx
      .insert(blogPosts)
      .values({ ...contentColumns(input), ...dates, authorId })
      .returning({ id: blogPosts.id });
    const id = row!.id;
    await syncContentPortals(
      tx,
      blogPostPortals,
      blogPostPortals.blogPostId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ blogPostId: id, portalId }),
    );
    const tagIds = await resolveTagIds(tx, input.tagNames);
    await syncPostTags(tx, id, tagIds);
    return id;
  });
}

export async function updateBlogPost(
  id: string,
  input: BlogInput,
  portalIds: number[],
  prevPublishedAt: Date | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const dates = computedDates(input, prevPublishedAt);
    await tx
      .update(blogPosts)
      .set({ ...contentColumns(input), ...dates, updatedAt: new Date() })
      .where(eq(blogPosts.id, id));
    await syncContentPortals(
      tx,
      blogPostPortals,
      blogPostPortals.blogPostId,
      id,
      input.distributionType,
      portalIds,
      (portalId) => ({ blogPostId: id, portalId }),
    );
    const tagIds = await resolveTagIds(tx, input.tagNames);
    await syncPostTags(tx, id, tagIds);
  });
}

export async function softDeleteBlogPost(id: string): Promise<void> {
  await db
    .update(blogPosts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(blogPosts.id, id));
}

/* ---- Lectura pública (resolución multiportal — se expone en Fase 14) ---- */

export async function listPublishedBlogForPortal(
  portalSlug: string,
  page = 1,
  limit = 20,
): Promise<Paginated<BlogPostDTO>> {
  const [portal] = await db
    .select({ id: portals.id })
    .from(portals)
    .where(and(eq(portals.slug, portalSlug), eq(portals.status, 'active')))
    .limit(1);
  if (!portal) return { data: [], meta: { page, limit, total: 0, totalPages: 1 } };
  return listBlogPaged({ page, limit, status: 'published', portalId: portal.id });
}


/** Artículo publicado por slug, si es visible para el portal dado. */
export async function getPublishedBlogBySlugForPortal(
  portalSlug: string,
  postSlug: string,
): Promise<BlogPostDTO | undefined> {
  const [portal] = await db
    .select({ id: portals.id })
    .from(portals)
    .where(and(eq(portals.slug, portalSlug), eq(portals.status, 'active')))
    .limit(1);
  if (!portal) return undefined;

  const [row] = await db
    .select(baseColumns)
    .from(blogPosts)
    .leftJoin(categories, eq(categories.id, blogPosts.categoryId))
    .leftJoin(featM, eq(featM.id, blogPosts.featuredMediaId))
    .leftJoin(ogM, eq(ogM.id, blogPosts.ogMediaId))
    .leftJoin(users, eq(users.id, blogPosts.authorId))
    .where(
      and(
        eq(blogPosts.slug, postSlug),
        eq(blogPosts.status, 'published'),
        isNull(blogPosts.deletedAt),
        portalVisibilityCondition(
          blogPosts.distributionType,
          blogPosts.id,
          blogPostPortals,
          blogPostPortals.blogPostId,
          blogPostPortals.portalId,
          portal.id,
        ),
      ),
    )
    .limit(1);
  if (!row) return undefined;
  const aux = await auxFor([row.post.id]);
  return rowToDTO(row, aux.portals.get(row.post.id) ?? [], aux.tags.get(row.post.id) ?? []);
}

/**
 * Publica los artículos programados cuya fecha ya pasó (plan §6, §14).
 * Devuelve los ids publicados para disparar el rebuild.
 */
export async function publishDueScheduledPosts(): Promise<string[]> {
  const now = new Date();
  const rows = await db
    .update(blogPosts)
    .set({ status: 'published', publishedAt: now, updatedAt: now })
    .where(
      and(
        eq(blogPosts.status, 'scheduled'),
        isNull(blogPosts.deletedAt),
        isNotNull(blogPosts.scheduledAt),
        lte(blogPosts.scheduledAt, now),
      ),
    )
    .returning({ id: blogPosts.id });
  return rows.map((r) => r.id);
}
