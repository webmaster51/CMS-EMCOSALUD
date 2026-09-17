import type { APIRoute } from 'astro';
import { readObject } from '@/lib/storage/s3';

export const prerender = false;

const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  zip: 'application/zip',
  mp4: 'video/mp4',
  webm: 'video/webm',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Sirve los archivos cuando STORAGE_DRIVER=fs (ruta pública `/media/<key>`).
 * En modo S3/MinIO los archivos se sirven directamente desde el bucket.
 */
export const GET: APIRoute = async ({ params }) => {
  const key = params.key ?? '';
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });

  const data = await readObject(key);
  if (!data) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  // undici acepta Buffer como cuerpo; el tipo BodyInit de la lib no lo refleja.
  return new Response(data as unknown as BodyInit, {
    headers: {
      'content-type': CONTENT_TYPE[ext] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
};
