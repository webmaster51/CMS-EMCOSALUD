import { and, count, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bulkJobs, certificates, companies, financialStatements, media } from '@/lib/db/schema';
import { mediaUrl } from '@/server/repositories/portalRepository';
import type { Paginated, PaginationParams } from '@/lib/validations/common';
import type { CompanyInput } from '@/lib/validations/company';

export type CompanyRow = typeof companies.$inferSelect & {
  certificateCount: number;
  logoUrl: string | null;
};

export async function listCompanies(onlyActive = false) {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      shortName: companies.shortName,
      taxId: companies.taxId,
      status: companies.status,
    })
    .from(companies)
    .orderBy(companies.name);
  return onlyActive ? rows.filter((r) => r.status === 'active') : rows;
}

export async function listCompaniesPaged(
  params: PaginationParams,
): Promise<Paginated<CompanyRow>> {
  const where = params.q
    ? or(
        ilike(companies.name, `%${params.q}%`),
        ilike(companies.shortName, `%${params.q}%`),
        ilike(companies.taxId, `%${params.q}%`),
      )
    : undefined;
  const offset = (params.page - 1) * params.limit;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        company: companies,
        logoThumb: media.thumbnailKey,
        logoKey: media.storageKey,
        certificateCount: sql<number>`(
          select count(*) from ${certificates} where ${certificates.companyId} = ${companies.id}
        )`,
      })
      .from(companies)
      .leftJoin(media, eq(media.id, companies.logoMediaId))
      .where(where)
      .orderBy(desc(companies.createdAt))
      .limit(params.limit)
      .offset(offset),
    db.select({ n: count() }).from(companies).where(where),
  ]);

  const total = totalRow?.n ?? 0;
  return {
    data: rows.map((r) => ({
      ...r.company,
      certificateCount: Number(r.certificateCount),
      logoUrl: mediaUrl(r.logoThumb, r.logoKey),
    })),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getCompany(id: number) {
  const [row] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return row;
}

export async function taxIdTaken(taxId: string, exceptId?: number): Promise<boolean> {
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      exceptId
        ? and(eq(companies.taxId, taxId), ne(companies.id, exceptId))
        : eq(companies.taxId, taxId),
    )
    .limit(1);
  return Boolean(row);
}

function normalize(data: CompanyInput) {
  return {
    name: data.name,
    shortName: data.shortName,
    taxId: data.taxId,
    description: data.description ? data.description : null,
    status: data.status,
    logoMediaId: data.logoMediaId ?? null,
  };
}

export async function createCompany(data: CompanyInput) {
  const [row] = await db.insert(companies).values(normalize(data)).returning();
  return row!;
}

export async function updateCompany(id: number, data: CompanyInput) {
  const [row] = await db
    .update(companies)
    .set({ ...normalize(data), updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning();
  return row;
}

export async function deleteCompany(id: number) {
  await db.delete(companies).where(eq(companies.id, id));
}

/** ¿La empresa tiene certificados o cargas masivas asociadas? */
export async function companyInUse(id: number): Promise<boolean> {
  const [cert] = await db
    .select({ x: sql`1` })
    .from(certificates)
    .where(eq(certificates.companyId, id))
    .limit(1);
  if (cert) return true;
  const [job] = await db
    .select({ x: sql`1` })
    .from(bulkJobs)
    .where(eq(bulkJobs.companyId, id))
    .limit(1);
  if (job) return true;
  const [fs] = await db
    .select({ x: sql`1` })
    .from(financialStatements)
    .where(eq(financialStatements.companyId, id))
    .limit(1);
  return Boolean(fs);
}
