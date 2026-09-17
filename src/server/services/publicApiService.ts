import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { categories, certificates, companies, media, portals } from '@/lib/db/schema';
import { mediaUrl } from '@/server/repositories/portalRepository';
import {
  getPublishedBlogBySlugForPortal,
  listBlogPaged,
} from '@/server/repositories/blogRepository';
import { listBoletinesPaged } from '@/server/repositories/boletinRepository';
import { listBoardPublicationsPaged } from '@/server/repositories/boardPublicationRepository';
import { listTrainingPaged } from '@/server/repositories/trainingRepository';
import { resolvePopupsForPortal } from '@/server/repositories/popupRepository';
import { resolveBannersForPortal } from '@/server/repositories/bannerRepository';
import { listPublishedFinancialStatementsForPortal } from '@/server/repositories/financialStatementRepository';
import type {
  ApiList,
  PublicBlogPost,
  PublicBoardPublication,
  PublicBoletin,
  PublicCertificate,
  PublicPortal,
  PublicTraining,
} from '@/lib/dto/public';
import type { PopupPublicDTO } from '@/lib/dto/popup';
import type { BannerPublicDTO } from '@/lib/dto/banner';
import type { PublicFinancialStatement } from '@/lib/dto/financialStatement';

export interface PublicQuery {
  page: number;
  limit: number;
  category?: string;
  tag?: string;
  search?: string;
  since?: string;
}

async function portalId(slug: string): Promise<number | null> {
  const [row] = await db
    .select({ id: portals.id })
    .from(portals)
    .where(and(eq(portals.slug, slug), eq(portals.status, 'active')))
    .limit(1);
  return row?.id ?? null;
}

async function categoryId(
  module: 'blog' | 'boletin' | 'board' | 'training',
  slug?: string,
): Promise<number | undefined> {
  if (!slug) return undefined;
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.module, module), eq(categories.slug, slug)))
    .limit(1);
  return row?.id;
}

const sinceDate = (s?: string) => {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export async function getPortal(slug: string): Promise<PublicPortal | null> {
  const [row] = await db
    .select({
      slug: portals.slug,
      name: portals.name,
      shortName: portals.shortName,
      url: portals.url,
      description: portals.description,
      logoThumb: media.thumbnailKey,
      logoKey: media.storageKey,
    })
    .from(portals)
    .leftJoin(media, eq(media.id, portals.logoMediaId))
    .where(and(eq(portals.slug, slug), eq(portals.status, 'active')))
    .limit(1);
  if (!row) return null;
  return {
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    url: row.url,
    description: row.description,
    logoUrl: mediaUrl(row.logoThumb, row.logoKey),
  };
}

export async function listBlog(
  slug: string,
  q: PublicQuery,
): Promise<ApiList<PublicBlogPost>> {
  const pid = await portalId(slug);
  if (!pid) return empty(q);
  const paged = await listBlogPaged({
    page: q.page,
    limit: q.limit,
    status: 'published',
    portalId: pid,
    categoryId: await categoryId('blog', q.category),
    tagSlug: q.tag,
    q: q.search,
    since: sinceDate(q.since),
  });
  return {
    data: paged.data.map((b) => ({
      slug: b.slug,
      title: b.title,
      excerpt: b.excerpt,
      contentHtml: b.contentHtml,
      category: b.categoryName,
      tags: b.tags,
      author: b.authorName,
      featuredImageUrl: b.featuredUrl,
      ogImageUrl: b.ogUrl,
      metaTitle: b.metaTitle,
      metaDescription: b.metaDescription,
      publishedAt: b.publishedAt,
    })),
    meta: paged.meta,
  };
}

export async function getBlogPostBySlug(
  portalSlug: string,
  postSlug: string,
): Promise<PublicBlogPost | null> {
  const b = await getPublishedBlogBySlugForPortal(portalSlug, postSlug);
  if (!b) return null;
  return {
    slug: b.slug,
    title: b.title,
    excerpt: b.excerpt,
    contentHtml: b.contentHtml,
    category: b.categoryName,
    tags: b.tags,
    author: b.authorName,
    featuredImageUrl: b.featuredUrl,
    ogImageUrl: b.ogUrl,
    metaTitle: b.metaTitle,
    metaDescription: b.metaDescription,
    publishedAt: b.publishedAt,
  };
}

export async function listBoletines(
  slug: string,
  q: PublicQuery,
): Promise<ApiList<PublicBoletin>> {
  const pid = await portalId(slug);
  if (!pid) return empty(q);
  const paged = await listBoletinesPaged({
    page: q.page,
    limit: q.limit,
    status: 'published',
    portalId: pid,
    categoryId: await categoryId('boletin', q.category),
    q: q.search,
    since: sinceDate(q.since),
  });
  return {
    data: paged.data.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      category: b.categoryName,
      pdfUrl: b.pdfUrl,
      coverUrl: b.coverUrl,
      publishedDate: b.publishedDate,
    })),
    meta: paged.meta,
  };
}

export async function listPublicaciones(
  slug: string,
  q: PublicQuery,
): Promise<ApiList<PublicBoardPublication>> {
  const pid = await portalId(slug);
  if (!pid) return empty(q);
  const paged = await listBoardPublicationsPaged({
    page: q.page,
    limit: q.limit,
    status: 'published',
    portalId: pid,
    q: q.search,
    since: sinceDate(q.since),
  });
  return {
    data: paged.data.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      imageUrl: b.imageUrl,
      publishedDate: b.publishedDate,
    })),
    meta: paged.meta,
  };
}

export async function listCapacitaciones(
  slug: string,
  q: PublicQuery,
): Promise<ApiList<PublicTraining>> {
  const pid = await portalId(slug);
  if (!pid) return empty(q);
  const paged = await listTrainingPaged({
    page: q.page,
    limit: q.limit,
    status: 'published',
    portalId: pid,
    categoryId: await categoryId('training', q.category),
    q: q.search,
    since: sinceDate(q.since),
  });
  return {
    data: paged.data.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.categoryName,
      fileUrl: t.fileUrl,
      fileKind: t.fileKind,
      imageUrl: t.imageUrl,
      publishedDate: t.publishedDate,
    })),
    meta: paged.meta,
  };
}

export async function listPopups(
  slug: string,
  path: string,
  device: 'all' | 'desktop' | 'tablet' | 'mobile',
): Promise<PopupPublicDTO[]> {
  return resolvePopupsForPortal(slug, path, device);
}

export async function listBanners(slug: string): Promise<BannerPublicDTO[]> {
  return resolveBannersForPortal(slug);
}

export async function listFinancialStatements(
  slug: string,
  q: { page: number; limit: number; year?: number },
): Promise<ApiList<PublicFinancialStatement>> {
  const pid = await portalId(slug);
  if (!pid) return empty(q);
  return listPublishedFinancialStatementsForPortal(pid, q);
}

export async function findCertificate(
  companyTaxId: string,
  taxYear: number,
  documentNumber: string,
): Promise<PublicCertificate | null> {
  const [row] = await db
    .select({
      documentNumber: certificates.documentNumber,
      fullName: certificates.fullName,
      taxYear: certificates.taxYear,
      company: companies.name,
      pdfKey: media.storageKey,
      issuedDate: certificates.issuedDate,
      status: certificates.status,
    })
    .from(certificates)
    .innerJoin(companies, eq(companies.id, certificates.companyId))
    .leftJoin(media, eq(media.id, certificates.pdfMediaId))
    .where(
      and(
        eq(companies.taxId, companyTaxId),
        eq(certificates.taxYear, taxYear),
        eq(certificates.documentNumber, documentNumber),
        eq(certificates.status, 'active'),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    documentNumber: row.documentNumber,
    fullName: row.fullName,
    taxYear: row.taxYear,
    company: row.company,
    pdfUrl: row.pdfKey ? mediaUrl(null, row.pdfKey) : null,
    issuedDate: row.issuedDate ? row.issuedDate.toISOString() : null,
  };
}

function empty<T>(q: { page: number; limit: number }): ApiList<T> {
  return { data: [], meta: { page: q.page, limit: q.limit, total: 0, totalPages: 1 } };
}
