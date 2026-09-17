import type { PortalRef } from '@/lib/dto/popup';

export type { PortalRef };

export interface BannerDTO {
  id: string;
  internalName: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  imageMediaId: string | null;
  imageUrl: string | null;
  mobileImageMediaId: string | null;
  mobileImageUrl: string | null;
  buttonText: string | null;
  url: string | null;
  linkType: 'internal' | 'external' | 'none';
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  status: 'draft' | 'scheduled' | 'active' | 'inactive' | 'finished';
  distributionType: 'specific' | 'general' | 'all';
  portals: PortalRef[];
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Forma que consume cada sitio (API pública). */
export interface BannerPublicDTO {
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
