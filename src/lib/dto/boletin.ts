export interface BoletinPortalRef {
  id: number;
  name: string;
  slug: string;
}

export interface BoletinDTO {
  id: number;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  publishedDate: string | null;
  distributionType: 'specific' | 'general' | 'all';
  portals: BoletinPortalRef[];
  categoryId: number | null;
  categoryName: string | null;
  pdfMediaId: string | null;
  pdfUrl: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}
