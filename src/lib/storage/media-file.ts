import { randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import {
  ALLOWED_MIME,
  EXT_BY_MIME,
  ZIP_BASED_MIME,
  kindForMime,
  type MediaKind,
} from './mime';

export interface ValidatedFile {
  buffer: Buffer;
  mime: string;
  kind: MediaKind;
  ext: string;
  size: number;
}

export type ValidationError =
  | { code: 'too_large'; max: number }
  | { code: 'mime_not_allowed'; mime: string }
  | { code: 'content_mismatch'; declared: string; detected: string | null }
  | { code: 'empty' };

/**
 * Valida un archivo subido: tamaño, MIME permitido y coincidencia de los
 * "magic bytes" con el MIME declarado (no se confía en la extensión).
 */
export async function validateUpload(
  buffer: Buffer,
  declaredMime: string,
  maxSize: number,
): Promise<{ ok: true; file: ValidatedFile } | { ok: false; error: ValidationError }> {
  if (buffer.length === 0) return { ok: false, error: { code: 'empty' } };
  if (buffer.length > maxSize) {
    return { ok: false, error: { code: 'too_large', max: maxSize } };
  }

  const kind = kindForMime(declaredMime);
  if (!kind || !(declaredMime in ALLOWED_MIME)) {
    return { ok: false, error: { code: 'mime_not_allowed', mime: declaredMime } };
  }

  const detected = await fileTypeFromBuffer(buffer);

  // text/plain y text/csv no tienen firma binaria: se aceptan sin comprobar.
  const textLike = declaredMime === 'text/plain' || declaredMime === 'text/csv';

  if (!textLike) {
    if (!detected) {
      return {
        ok: false,
        error: { code: 'content_mismatch', declared: declaredMime, detected: null },
      };
    }
    const matches =
      detected.mime === declaredMime ||
      (ZIP_BASED_MIME.has(declaredMime) && detected.mime === 'application/zip') ||
      // jpeg a veces se detecta como image/jpg
      (declaredMime === 'image/jpeg' && detected.mime === 'image/jpeg');
    if (!matches) {
      return {
        ok: false,
        error: {
          code: 'content_mismatch',
          declared: declaredMime,
          detected: detected.mime,
        },
      };
    }
  }

  return {
    ok: true,
    file: {
      buffer,
      mime: declaredMime,
      kind,
      ext: EXT_BY_MIME[declaredMime] ?? 'bin',
      size: buffer.length,
    },
  };
}

/** Clave única en el bucket: media/AAAA/MM/<uuid>.<ext> */
export function buildStorageKey(ext: string, suffix = ''): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `media/${yyyy}/${mm}/${randomUUID()}${suffix}.${ext}`;
}

export interface ImageInfo {
  width: number | null;
  height: number | null;
  thumbnail: Buffer | null;
}

/** Extrae dimensiones y genera una miniatura webp (~480px) para imágenes raster. */
export async function processImage(buffer: Buffer): Promise<ImageInfo> {
  try {
    const img = sharp(buffer, { failOn: 'none' });
    const meta = await img.metadata();
    const thumbnail = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return {
      width: meta.width ?? null,
      height: meta.height ?? null,
      thumbnail,
    };
  } catch {
    return { width: null, height: null, thumbnail: null };
  }
}
