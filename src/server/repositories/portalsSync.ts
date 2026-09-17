import { eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db/client';
import { portals } from '@/lib/db/schema';
import type { DistributionType } from '@/lib/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Sincroniza las filas de una tabla puente contenido↔portal (plan §5.2).
 * Con `all` (o lista vacía) no se guarda ninguna fila; la resolución en lectura
 * lo interpreta. `buildRow` construye cada fila tipada de la tabla puente.
 */
export async function syncContentPortals<TInsert>(
  tx: Tx,
  junction: PgTable,
  contentIdCol: AnyPgColumn,
  contentId: string | number,
  distributionType: DistributionType,
  portalIds: number[],
  buildRow: (portalId: number) => TInsert,
): Promise<void> {
  await tx.delete(junction).where(eq(contentIdCol, contentId as never));
  if (distributionType === 'all' || portalIds.length === 0) return;
  await tx.insert(junction).values(portalIds.map(buildRow) as never[]);
}

/** Filtra ids de portal a los que realmente existen. */
export async function existingPortalIds(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: portals.id })
    .from(portals)
    .where(inArray(portals.id, ids));
  const set = new Set(rows.map((r) => r.id));
  return ids.filter((id) => set.has(id));
}

/**
 * Condición SQL "visible para el portal": distribution_type = 'all'
 * O existe fila en la tabla puente para ese portal (plan §5.3).
 */
export function portalVisibilityCondition(
  distributionCol: AnyPgColumn,
  contentIdCol: AnyPgColumn,
  junction: PgTable,
  junctionContentIdCol: AnyPgColumn,
  junctionPortalIdCol: AnyPgColumn,
  portalId: number,
): SQL {
  return sql`(${distributionCol} = 'all' OR EXISTS (
    SELECT 1 FROM ${junction}
    WHERE ${junctionContentIdCol} = ${contentIdCol} AND ${junctionPortalIdCol} = ${portalId}
  ))`;
}
