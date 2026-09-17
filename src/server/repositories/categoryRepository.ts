import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { categories } from '@/lib/db/schema';
import { slugify } from '@/lib/validations/common';
import type { CategoryModule } from '@/lib/validations/category';

export interface CategoryDTO {
  id: number;
  name: string;
  slug: string;
}

export async function listCategories(module: CategoryModule): Promise<CategoryDTO[]> {
  return db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories)
    .where(and(eq(categories.module, module), isNull(categories.portalId)))
    .orderBy(asc(categories.name));
}

export async function getCategory(
  id: number,
  module: CategoryModule,
): Promise<CategoryDTO | undefined> {
  const [row] = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.module, module)))
    .limit(1);
  return row;
}

/** Busca por slug o crea la categoría (global) para ese módulo. */
export async function findOrCreateCategory(
  module: CategoryModule,
  name: string,
): Promise<CategoryDTO> {
  const slug = slugify(name);
  const [existing] = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories)
    .where(
      and(eq(categories.module, module), eq(categories.slug, slug), isNull(categories.portalId)),
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(categories)
    .values({ module, name: name.trim(), slug })
    .returning({ id: categories.id, name: categories.name, slug: categories.slug });
  return created!;
}
