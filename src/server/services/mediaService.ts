import { createHash } from 'node:crypto';
import { getEnv } from '@/lib/env';
import { deleteObject, putObject } from '@/lib/storage/s3';
import {
  buildStorageKey,
  processImage,
  validateUpload,
} from '@/lib/storage/media-file';
import { recordAudit } from '@/server/services/auditService';
import { done, fail, type ServiceResult } from '@/server/services/result';
import * as repo from '@/server/repositories/mediaRepository';
import { toMediaDTO } from '@/server/repositories/mediaRepository';
import type { MediaDTO } from '@/lib/dto/media';

interface Actor {
  userId: string;
  name?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

const humanBytes = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export async function uploadMedia(
  file: File,
  internalName: string | null,
  actor: Actor,
): Promise<ServiceResult<MediaDTO>> {
  const maxSize = getEnv().MAX_FILE_SIZE;
  const buffer = Buffer.from(await file.arrayBuffer());

  const validation = await validateUpload(buffer, file.type, maxSize);
  if (!validation.ok) {
    const e = validation.error;
    const message =
      e.code === 'too_large'
        ? `El archivo supera el límite de ${humanBytes(e.max)}`
        : e.code === 'mime_not_allowed'
          ? `Tipo de archivo no permitido (${e.mime || 'desconocido'})`
          : e.code === 'empty'
            ? 'El archivo está vacío'
            : `El contenido del archivo no coincide con su tipo declarado (${e.detected ?? 'no reconocido'})`;
    return fail(422, message);
  }

  const { kind, ext, mime, size } = validation.file;
  const storageKey = buildStorageKey(ext);
  const checksum = createHash('sha256').update(buffer).digest('hex');

  let width: number | null = null;
  let height: number | null = null;
  let thumbnailKey: string | null = null;

  if (kind === 'image') {
    const info = await processImage(buffer);
    width = info.width;
    height = info.height;
    if (info.thumbnail) {
      thumbnailKey = storageKey.replace(/\.\w+$/, '_thumb.webp');
      await putObject(thumbnailKey, info.thumbnail, 'image/webp');
    }
  }

  try {
    await putObject(storageKey, buffer, mime);
  } catch {
    if (thumbnailKey) await deleteObject(thumbnailKey).catch(() => undefined);
    return fail(502, 'No se pudo guardar el archivo en el almacenamiento');
  }

  const row = await repo.insertMedia({
    filename: storageKey.split('/').pop()!,
    originalName: file.name || `archivo.${ext}`,
    internalName: internalName?.trim() || null,
    mimeType: mime,
    sizeBytes: size,
    storageKey,
    thumbnailKey,
    kind,
    width,
    height,
    checksumSha256: checksum,
    uploadedBy: actor.userId || null,
  });

  await recordAudit({
    userId: actor.userId,
    action: 'upload',
    module: 'multimedia',
    entityType: 'media',
    entityId: row.id,
    summary: `Subió "${row.originalName}" (${humanBytes(size)})`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });

  return done(toMediaDTO(row, actor.name ?? null));
}

export async function renameMedia(
  id: string,
  internalName: string | null,
  actor: Actor,
): Promise<ServiceResult<MediaDTO>> {
  const row = await repo.updateInternalName(id, internalName?.trim() || null);
  if (!row) return fail(404, 'Archivo no encontrado');
  return done(toMediaDTO(row, actor.name ?? null));
}

export async function deleteMedia(
  id: string,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const row = await repo.getMedia(id);
  if (!row || row.deletedAt) return fail(404, 'Archivo no encontrado');
  if (await repo.mediaInUse(id)) {
    return fail(409, 'El archivo está en uso por uno o más contenidos. Reemplázalo antes de eliminarlo.');
  }

  await repo.softDeleteMedia(id);
  await deleteObject(row.storageKey).catch(() => undefined);
  if (row.thumbnailKey) await deleteObject(row.thumbnailKey).catch(() => undefined);

  await recordAudit({
    userId: actor.userId,
    action: 'delete',
    module: 'multimedia',
    entityType: 'media',
    entityId: id,
    summary: `Eliminó "${row.originalName}"`,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return done({ id });
}
