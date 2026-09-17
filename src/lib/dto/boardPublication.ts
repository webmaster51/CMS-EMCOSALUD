export interface PortalRef {
  id: number;
  name: string;
  slug: string;
}

export interface BoardPublicationDTO {
  id: number;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  publishedDate: string | null;
  distributionType: 'specific' | 'general' | 'all';
  portals: PortalRef[];
  imageMediaId: string | null;
  imageUrl: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}
