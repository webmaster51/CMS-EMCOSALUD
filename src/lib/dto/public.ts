/** Formas que consumen los sitios externos vía /api/v1. Sin campos internos. */

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

export interface PublicPortal {
  slug: string;
  name: string;
  shortName: string;
  url: string;
  description: string | null;
  logoUrl: string | null;
}

export interface PublicBlogPost {
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

export interface PublicBoletin {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  pdfUrl: string | null;
  coverUrl: string | null;
  publishedDate: string | null;
}

export interface PublicBoardPublication {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  publishedDate: string | null;
}

export interface PublicTraining {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  fileUrl: string | null;
  fileKind: string | null;
  imageUrl: string | null;
  publishedDate: string | null;
}

export interface PublicCertificate {
  documentNumber: string;
  fullName: string | null;
  taxYear: number;
  company: string;
  pdfUrl: string | null;
  issuedDate: string | null;
}
