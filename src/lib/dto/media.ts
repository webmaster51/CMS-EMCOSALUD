import type { MediaKind } from '@/lib/storage/mime';

export interface MediaDTO {
  id: string;
  originalName: string;
  internalName: string | null;
  mimeType: string;
  kind: MediaKind;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  url: string;
  thumbnailUrl: string | null;
  uploaderName: string | null;
  createdAt: string;
}
