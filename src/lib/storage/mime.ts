import type { mediaKind } from '@/lib/db/schema';

export type MediaKind = (typeof mediaKind.enumValues)[number];

/**
 * MIME permitidos en la biblioteca multimedia y su clasificación.
 * SVG queda excluido a propósito (vector de XSS al servirse en línea);
 * se admitirá con saneamiento en una fase posterior.
 */
export const ALLOWED_MIME: Record<string, MediaKind> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'text/plain': 'document',
  'text/csv': 'document',
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'video/mp4': 'video',
  'video/webm': 'video',
};

export const IMAGE_MIME = Object.entries(ALLOWED_MIME)
  .filter(([, kind]) => kind === 'image')
  .map(([mime]) => mime);

export function kindForMime(mime: string): MediaKind | null {
  return ALLOWED_MIME[mime] ?? null;
}

/** Algunos formatos Office comparten firma zip; se acepta el MIME declarado. */
export const ZIP_BASED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
]);

export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
