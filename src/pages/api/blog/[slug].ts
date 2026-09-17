import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client';
import { blogPosts, categories, media, users } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { mediaUrl } from '@/server/repositories/portalRepository';

export const prerender = false;

const featM = alias(media, 'feat_m');
const ogM = alias(media, 'og_m');

export const GET: APIRoute = async ({ params }) => {
  try {
    const { slug } = params;
    if (!slug) {
      return new Response(JSON.stringify({ success: false, error: 'Slug no proporcionado' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Drizzle .select() siempre devuelve un array. Tomamos el primer elemento [row]
    const rows = await db
      .select({
        post: blogPosts,
        categoryName: categories.name,
        featThumb: featM.thumbnailKey,
        featKey: featM.storageKey,
        ogThumb: ogM.thumbnailKey,
        ogKey: ogM.storageKey,
        authorName: users.name,
      })
      .from(blogPosts)
      .leftJoin(categories, eq(categories.id, blogPosts.categoryId))
      .leftJoin(featM, eq(featM.id, blogPosts.featuredMediaId))
      .leftJoin(ogM, eq(ogM.id, blogPosts.ogMediaId))
      .leftJoin(users, eq(users.id, blogPosts.authorId))
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published'), isNull(blogPosts.deletedAt)))
      .limit(1);

    const row = rows[0];

    if (!row) {
      return new Response(JSON.stringify({ success: false, error: 'Artículo no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const p = row.post;

    const postDto = {
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      contentHtml: p.contentHtml,
      status: p.status,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      categoryName: row.categoryName,
      featuredUrl: mediaUrl(row.featThumb, row.featKey),
      ogUrl: mediaUrl(row.ogThumb, row.ogKey),
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      authorName: row.authorName,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };

    return new Response(
      JSON.stringify({ success: true, data: postDto }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error al obtener el post por slug:', error);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};