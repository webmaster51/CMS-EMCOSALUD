/** Forma serializada de un portal tal como la devuelve la API admin. */
export interface PortalDTO {
  id: number;
  name: string;
  shortName: string;
  slug: string;
  url: string;
  description: string | null;
  status: 'active' | 'inactive';
  deployHookUrl: string | null;
  logoMediaId: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  apiKeyCount: number;
}

export interface ApiKeyDTO {
  id: number;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PagedDTO<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
