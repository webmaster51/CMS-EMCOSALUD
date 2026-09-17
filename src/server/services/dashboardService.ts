import { and, count, desc, eq, exists, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { findPortalBySlug, listPortals } from '@/server/repositories/portalRepository';

/**
 * Condición SQL "este contenido es visible para el portal <portalId>":
 *   distribution_type = 'all'  OR  existe fila en la tabla puente.
 * (plan §5.3). Se aplica a boletines, publicaciones, blog, capacitaciones y popups.
 */
function visibleToPortal(
  distributionCol: AnyPgColumn,
  contentIdCol: AnyPgColumn,
  junctionTable: PgTable,
  junctionContentIdCol: AnyPgColumn,
  junctionPortalIdCol: AnyPgColumn,
  portalId: number,
): SQL {
  const condition = or(
    eq(distributionCol, 'all'),
    exists(
      db
        .select({ x: sql`1` })
        .from(junctionTable)
        .where(
          and(
            eq(junctionContentIdCol, contentIdCol),
            eq(junctionPortalIdCol, portalId),
          ),
        ),
    ),
  );
  // `or(...)` nunca es undefined aquí porque pasamos ≥ 2 condiciones.
  return condition as SQL;
}

async function countRows(table: PgTable, where: SQL | undefined): Promise<number> {
  const [row] = await db.select({ n: count() }).from(table).where(where);
  return row?.n ?? 0;
}

interface ContentCountArgs {
  table: PgTable;
  distributionCol: AnyPgColumn;
  idCol: AnyPgColumn;
  deletedAtCol: AnyPgColumn;
  junctionTable: PgTable;
  junctionContentIdCol: AnyPgColumn;
  junctionPortalIdCol: AnyPgColumn;
}

/** Conteo de un tipo de contenido multiportal, filtrado (o no) por portal. */
async function countContent(
  args: ContentCountArgs,
  portalId: number | null,
): Promise<number> {
  const notDeleted = isNull(args.deletedAtCol);
  if (portalId == null) return countRows(args.table, notDeleted);
  return countRows(
    args.table,
    and(
      notDeleted,
      visibleToPortal(
        args.distributionCol,
        args.idCol,
        args.junctionTable,
        args.junctionContentIdCol,
        args.junctionPortalIdCol,
        portalId,
      ),
    ),
  );
}

const CONTENT_ARGS = {
  boletines: {
    table: s.boletines,
    distributionCol: s.boletines.distributionType,
    idCol: s.boletines.id,
    deletedAtCol: s.boletines.deletedAt,
    junctionTable: s.boletinPortals,
    junctionContentIdCol: s.boletinPortals.boletinId,
    junctionPortalIdCol: s.boletinPortals.portalId,
  },
  publicaciones: {
    table: s.boardPublications,
    distributionCol: s.boardPublications.distributionType,
    idCol: s.boardPublications.id,
    deletedAtCol: s.boardPublications.deletedAt,
    junctionTable: s.boardPublicationPortals,
    junctionContentIdCol: s.boardPublicationPortals.boardPublicationId,
    junctionPortalIdCol: s.boardPublicationPortals.portalId,
  },
  blog: {
    table: s.blogPosts,
    distributionCol: s.blogPosts.distributionType,
    idCol: s.blogPosts.id,
    deletedAtCol: s.blogPosts.deletedAt,
    junctionTable: s.blogPostPortals,
    junctionContentIdCol: s.blogPostPortals.blogPostId,
    junctionPortalIdCol: s.blogPostPortals.portalId,
  },
  capacitaciones: {
    table: s.trainingMaterials,
    distributionCol: s.trainingMaterials.distributionType,
    idCol: s.trainingMaterials.id,
    deletedAtCol: s.trainingMaterials.deletedAt,
    junctionTable: s.trainingMaterialPortals,
    junctionContentIdCol: s.trainingMaterialPortals.trainingMaterialId,
    junctionPortalIdCol: s.trainingMaterialPortals.portalId,
  },
  popups: {
    table: s.popups,
    distributionCol: s.popups.distributionType,
    idCol: s.popups.id,
    deletedAtCol: s.popups.deletedAt,
    junctionTable: s.popupPortals,
    junctionContentIdCol: s.popupPortals.popupId,
    junctionPortalIdCol: s.popupPortals.portalId,
  },
  banners: {
    table: s.banners,
    distributionCol: s.banners.distributionType,
    idCol: s.banners.id,
    deletedAtCol: s.banners.deletedAt,
    junctionTable: s.bannerPortals,
    junctionContentIdCol: s.bannerPortals.bannerId,
    junctionPortalIdCol: s.bannerPortals.portalId,
  },
  estadosFinancieros: {
    table: s.financialStatements,
    distributionCol: s.financialStatements.distributionType,
    idCol: s.financialStatements.id,
    deletedAtCol: s.financialStatements.deletedAt,
    junctionTable: s.financialStatementPortals,
    junctionContentIdCol: s.financialStatementPortals.financialStatementId,
    junctionPortalIdCol: s.financialStatementPortals.portalId,
  },
} satisfies Record<string, ContentCountArgs>;

export interface GlobalStats {
  portalSlug: string | null;
  portalName: string | null;
  portales: number;
  boletines: number;
  publicaciones: number;
  blog: number;
  capacitaciones: number;
  certificados: number;
  estadosFinancieros: number;
  empresas: number;
  banners: number;
  popups: number;
  usuarios: number;
}

export async function getGlobalStats(portalSlug: string | null): Promise<GlobalStats> {
  const portal = portalSlug ? await findPortalBySlug(portalSlug) : undefined;
  const portalId = portal?.id ?? null;

  const [
    portales,
    boletines,
    publicaciones,
    blog,
    capacitaciones,
    popups,
    banners,
    estadosFinancieros,
    certificados,
    empresas,
    usuarios,
  ] = await Promise.all([
    countRows(s.portals, undefined),
    countContent(CONTENT_ARGS.boletines, portalId),
    countContent(CONTENT_ARGS.publicaciones, portalId),
    countContent(CONTENT_ARGS.blog, portalId),
    countContent(CONTENT_ARGS.capacitaciones, portalId),
    countContent(CONTENT_ARGS.popups, portalId),
    countContent(CONTENT_ARGS.banners, portalId),
    countContent(CONTENT_ARGS.estadosFinancieros, portalId),
    countRows(
      s.certificates, 
      portalId ? eq(s.certificates.companyId, portalId) : undefined
    ),
    countRows(s.companies, undefined),
    countRows(s.users, eq(s.users.status, 'active')),
  ]);

  return {
    portalSlug: portal?.slug ?? null,
    portalName: portal?.name ?? null,
    portales,
    boletines,
    publicaciones,
    blog,
    capacitaciones,
    certificados,
    estadosFinancieros,
    empresas,
    banners,
    popups,
    usuarios,
  };
}

export interface PerPortalRow {
  slug: string;
  name: string;
  status: 'active' | 'inactive';
  blog: number;
  boletines: number;
  publicaciones: number;
  capacitaciones: number;
  banners: number;
  popups: number;
}

/**
 * Dashboard con caché de 3 minutos en `dashboard_stats` (plan §12). Cuando hay un
 * portal seleccionado se calcula al vuelo (son pocos conteos). `refresh` fuerza
 * el recálculo (lo usa el planificador).
 */
export interface DashboardData {
  global: GlobalStats;
  perPortal: PerPortalRow[];
}

const CACHE_KEY = 'dashboard:v1';
const CACHE_TTL_MS = 3 * 60_000;

export async function getDashboard(
  portalSlug: string | null,
  opts: { refresh?: boolean } = {},
): Promise<DashboardData> {
  if (portalSlug && !opts.refresh) {
    const [global, perPortal] = await Promise.all([
      getGlobalStats(portalSlug),
      cachedPerPortal(opts.refresh),
    ]);
    return { global, perPortal };
  }

  if (!opts.refresh) {
    const [row] = await db
      .select()
      .from(s.dashboardStats)
      .where(eq(s.dashboardStats.key, CACHE_KEY))
      .limit(1);
    if (row && Date.now() - row.computedAt.getTime() < CACHE_TTL_MS) {
      return row.value as DashboardData;
    }
  }

  const [global, perPortal] = await Promise.all([
    getGlobalStats(null),
    getPerPortalStats(),
  ]);
  const data: DashboardData = { global, perPortal };
  await db
    .insert(s.dashboardStats)
    .values({ key: CACHE_KEY, value: data, computedAt: new Date() })
    .onConflictDoUpdate({
      target: s.dashboardStats.key,
      set: { value: data, computedAt: new Date() },
    });
  return data;
}

async function cachedPerPortal(refresh?: boolean): Promise<PerPortalRow[]> {
  if (!refresh) {
    const [row] = await db
      .select()
      .from(s.dashboardStats)
      .where(eq(s.dashboardStats.key, CACHE_KEY))
      .limit(1);
    if (row && Date.now() - row.computedAt.getTime() < CACHE_TTL_MS) {
      return (row.value as DashboardData).perPortal;
    }
  }
  return getPerPortalStats();
}

export async function getPerPortalStats(): Promise<PerPortalRow[]> {
  const portals = await listPortals();
  return Promise.all(
    portals.map(async (p) => {
      const [blog, boletines, publicaciones, capacitaciones, banners, popups] =
        await Promise.all([
          countContent(CONTENT_ARGS.blog, p.id),
          countContent(CONTENT_ARGS.boletines, p.id),
          countContent(CONTENT_ARGS.publicaciones, p.id),
          countContent(CONTENT_ARGS.capacitaciones, p.id),
          countContent(CONTENT_ARGS.banners, p.id),
          countContent(CONTENT_ARGS.popups, p.id),
        ]);
      return {
        slug: p.slug,
        name: p.name,
        status: p.status,
        blog,
        boletines,
        publicaciones,
        capacitaciones,
        banners,
        popups,
      };
    }),
  );
}

export interface ActivityRow {
  id: number;
  action: string;
  module: string;
  summary: string;
  userName: string | null;
  createdAt: Date;
}

export async function getRecentActivity(limit = 8): Promise<ActivityRow[]> {
  return db
    .select({
      id: s.auditLogs.id,
      action: s.auditLogs.action,
      module: s.auditLogs.module,
      summary: s.auditLogs.summary,
      userName: s.users.name,
      createdAt: s.auditLogs.createdAt,
    })
    .from(s.auditLogs)
    .leftJoin(s.users, eq(s.users.id, s.auditLogs.userId))
    .orderBy(desc(s.auditLogs.createdAt))
    .limit(limit);
}
