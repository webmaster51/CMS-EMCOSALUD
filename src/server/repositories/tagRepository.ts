import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { blogPostTags, tags } from '@/lib/db/schema';
import { slugify } from '@/lib/validations/common';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface TagDTO {
  id: number;
  name: string;
  slug: string;
}

export async function listTags(): Promise<TagDTO[]> {
  return db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(tags)
    .orderBy(asc(tags.name));
}

/** Resuelve nombres de etiqueta a ids, creando las que falten. */
export async function resolveTagIds(tx: Tx, names: string[]): Promise<number[]> {
  const cleaned = Array.from(
    new Map(
      names
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => [slugify(n), n] as const),
    ).values(),
  );
  if (cleaned.length === 0) return [];

  const slugs = cleaned.map(slugify);
  const existing = await tx
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(inArray(tags.slug, slugs));
  const bySlug = new Map(existing.map((t) => [t.slug, t.id]));

  const toCreate = cleaned.filter((n) => !bySlug.has(slugify(n)));
  if (toCreate.length > 0) {
    const created = await tx
      .insert(tags)
      .values(toCreate.map((name) => ({ name, slug: slugify(name) })))
      .returning({ id: tags.id, slug: tags.slug });
    for (const c of created) bySlug.set(c.slug, c.id);
  }
  return slugs.map((s) => bySlug.get(s)!).filter(Boolean);
}

export async function syncPostTags(
  tx: Tx,
  blogPostId: string,
  tagIds: number[],
): Promise<void> {
  await tx.delete(blogPostTags).where(eq(blogPostTags.blogPostId, blogPostId));
  if (tagIds.length === 0) return;
  await tx
    .insert(blogPostTags)
    .values(tagIds.map((tagId) => ({ blogPostId, tagId })));
}
