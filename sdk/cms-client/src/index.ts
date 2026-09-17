/**
 * @emcosalud/cms-client
 *
 * Cliente mínimo (solo `fetch`) para que cada sitio consuma su contenido del
 * CMS EMCO SALUD. Compatible con Astro 4/5 (build-time), Node y navegador.
 *
 *   import { createCmsClient } from '@emcosalud/cms-client';
 *
 *   const cms = createCmsClient({
 *     baseUrl: import.meta.env.CMS_API_URL,   // https://cms.emcosalud.com/api/v1
 *     apiKey: import.meta.env.CMS_API_KEY,
 *     portal: 'emcosalud',
 *   });
 *
 *   const { data: posts } = await cms.blog.list({ page: 1 });
 *   const post = await cms.blog.get('campana-de-prevencion');
 *   const popups = await cms.popups.forPage(location.pathname, 'mobile');
 */

export interface CmsClientOptions {
  baseUrl: string;
  apiKey: string;
  portal: string;
  /** `fetch` alternativo (p. ej. en tests). */
  fetch?: typeof fetch;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface ApiList<T> {
  data: T[];
  meta: PageMeta;
}

export interface ListQuery {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  search?: string;
  since?: string | Date;
}

export interface Portal {
  slug: string;
  name: string;
  shortName: string;
  url: string;
  description: string | null;
  logoUrl: string | null;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml: string | null;
  category: string | null;
  tags: string[];
  author: string | null;
  featuredImageUrl: string | null;
  ogImageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
}

export interface Boletin {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  pdfUrl: string | null;
  coverUrl: string | null;
  publishedDate: string | null;
}

export interface BoardPublication {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  publishedDate: string | null;
}

export interface Training {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  fileUrl: string | null;
  fileKind: string | null;
  imageUrl: string | null;
  publishedDate: string | null;
}

export interface Popup {
  id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  buttonText: string | null;
  url: string | null;
  linkType: 'internal' | 'external' | 'none';
  priority: number;
  frequency: 'always' | 'once_session' | 'once_user' | 'every_x_days';
  frequencyDays: number | null;
  device: 'all' | 'desktop' | 'tablet' | 'mobile';
}

export interface Banner {
  id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  buttonText: string | null;
  url: string | null;
  linkType: 'internal' | 'external' | 'none';
  sortOrder: number;
}

export interface FinancialStatementFile {
  label: string;
  url: string | null;
}

export interface FinancialStatement {
  fiscalYear: number;
  title: string | null;
  summary: string | null;
  company: { name: string; shortName: string };
  publishedDate: string | null;
  files: FinancialStatementFile[];
}

export interface Certificate {
  documentNumber: string;
  fullName: string | null;
  taxYear: number;
  company: string;
  pdfUrl: string | null;
  issuedDate: string | null;
}

export class CmsError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'CmsError';
    this.status = status;
  }
}

export function createCmsClient(opts: CmsClientOptions) {
  const f = opts.fetch ?? fetch;
  const base = opts.baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, query: Record<string, unknown> = {}): Promise<T> {
    const url = new URL(base + path);
    url.searchParams.set('portal', opts.portal);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, v instanceof Date ? v.toISOString() : String(v));
    }
    const res = await f(url.toString(), { headers: { 'x-api-key': opts.apiKey } });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        body && typeof body === 'object' && 'error' in body
          ? String((body as { error: unknown }).error)
          : `CMS ${res.status}`;
      throw new CmsError(res.status, msg);
    }
    return body as T;
  }

  const listArgs = (q: ListQuery = {}) => ({
    page: q.page,
    limit: q.limit,
    category: q.category,
    tag: q.tag,
    search: q.search,
    since: q.since,
  });

  return {
    portal: () => request<Portal>(`/portales/${opts.portal}`),

    blog: {
      list: (q?: ListQuery) => request<ApiList<BlogPost>>('/blog', listArgs(q)),
      get: (slug: string) => request<BlogPost>(`/blog/${encodeURIComponent(slug)}`),
    },
    boletines: {
      list: (q?: ListQuery) => request<ApiList<Boletin>>('/boletines', listArgs(q)),
    },
    publicaciones: {
      list: (q?: ListQuery) =>
        request<ApiList<BoardPublication>>('/publicaciones', listArgs(q)),
    },
    capacitaciones: {
      list: (q?: ListQuery) => request<ApiList<Training>>('/capacitaciones', listArgs(q)),
    },
    popups: {
      forPage: (path: string, device: Popup['device'] = 'all') =>
        request<{ data: Popup[] }>('/popups', { path, device }).then((r) => r.data),
    },
    banners: {
      /** Banners de la página de inicio del portal, ya ordenados como carrusel. */
      list: () => request<{ data: Banner[] }>('/banners').then((r) => r.data),
    },
    estadosFinancieros: {
      list: (q: { page?: number; limit?: number; year?: number } = {}) =>
        request<ApiList<FinancialStatement>>('/estados-financieros', q),
    },
    certificados: {
      find: (company: string, year: number, document: string) =>
        request<Certificate>('/certificados', { company, year, document }),
    },
  };
}

export type CmsClient = ReturnType<typeof createCmsClient>;
