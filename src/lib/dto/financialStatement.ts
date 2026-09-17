import type { PortalRef } from '@/lib/dto/popup';

export type { PortalRef };

export interface FinancialStatementFileDTO {
  id: number;
  label: string;
  mediaId: string;
  url: string | null;
  sortOrder: number;
}

export interface FinancialStatementDTO {
  id: number;
  companyId: number;
  companyName: string;
  fiscalYear: number;
  title: string | null;
  summary: string | null;
  publishedDate: string | null;
  status: 'draft' | 'published' | 'archived';
  distributionType: 'specific' | 'general' | 'all';
  portals: PortalRef[];
  files: FinancialStatementFileDTO[];
  authorName: string | null;
  createdAt: string;
}

/** Forma que consumen los sitios (API pública). */
export interface PublicFinancialStatement {
  fiscalYear: number;
  title: string | null;
  summary: string | null;
  company: { name: string; shortName: string };
  publishedDate: string | null;
  files: { label: string; url: string | null }[];
}
