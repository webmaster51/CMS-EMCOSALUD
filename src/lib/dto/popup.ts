export interface PortalRef {
  id: number;
  name: string;
  slug: string;
}

export interface PopupDTO {
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
  pageMode: 'all_pages' | 'specific_pages';
  paths: string[];
  startsAt: string | null;
  endsAt: string | null;
  status: 'draft' | 'scheduled' | 'active' | 'inactive' | 'finished';
  priority: number;
  frequency: 'always' | 'once_session' | 'once_user' | 'every_x_days';
  frequencyDays: number | null;
  device: 'all' | 'desktop' | 'tablet' | 'mobile';
  distributionType: 'specific' | 'general' | 'all';
  portals: PortalRef[];
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Forma que consume cada sitio (API pública, Fase 14). */
export interface PopupPublicDTO {
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
