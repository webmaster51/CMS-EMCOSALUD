export interface PortalRef {
  id: number;
  name: string;
  slug: string;
}

export interface BlogPostDTO {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  contentHtml: string | null;
  contentJson: unknown;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  publishedAt: string | null;
  scheduledAt: string | null;
  distributionType: 'specific' | 'general' | 'all';
  portals: PortalRef[];
  categoryId: number | null;
  categoryName: string | null;
  tags: string[];
  featuredMediaId: string | null;
  featuredUrl: string | null;
  ogMediaId: string | null;
  ogUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}
