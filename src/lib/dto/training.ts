export interface PortalRef {
  id: number;
  name: string;
  slug: string;
}

export interface TrainingDTO {
  id: number;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  publishedDate: string | null;
  distributionType: 'specific' | 'general' | 'all';
  portals: PortalRef[];
  categoryId: number | null;
  categoryName: string | null;
  fileMediaId: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileKind: 'image' | 'document' | 'video' | 'archive' | 'other' | null;
  imageMediaId: string | null;
  imageUrl: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}
