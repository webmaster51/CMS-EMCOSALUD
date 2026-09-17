import { FileArchive, FileText, Film, File as FileIcon, Image as ImageIcon } from 'lucide-react';
import type { MediaKind } from '@/lib/storage/mime';

export function MediaIcon({ kind, className = 'h-5 w-5' }: { kind: MediaKind; className?: string }) {
  switch (kind) {
    case 'image':
      return <ImageIcon className={className} />;
    case 'document':
      return <FileText className={className} />;
    case 'video':
      return <Film className={className} />;
    case 'archive':
      return <FileArchive className={className} />;
    default:
      return <FileIcon className={className} />;
  }
}

export const KIND_LABEL: Record<MediaKind, string> = {
  image: 'Imágenes',
  document: 'Documentos',
  video: 'Videos',
  archive: 'Comprimidos',
  other: 'Otros',
};

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
