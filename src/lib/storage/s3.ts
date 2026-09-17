import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { fsDriver } from './fs-driver';

/**
 * Capa de almacenamiento. Driver por defecto: S3/MinIO.
 * `STORAGE_DRIVER=fs` usa el disco local (desarrollo sin Docker).
 */
const isFs = () => getEnv().STORAGE_DRIVER === 'fs';

const globalForS3 = globalThis as unknown as { __cmsS3?: S3Client };

function s3Client(): S3Client {
  const env = getEnv();
  const client =
    globalForS3.__cmsS3 ??
    new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY,
      },
    });
  if (env.NODE_ENV !== 'production') globalForS3.__cmsS3 = client;
  return client;
}

export const bucket = (): string => getEnv().STORAGE_BUCKET;

export function publicUrl(key: string): string {
  return `${getEnv().STORAGE_PUBLIC_URL.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
}

let bucketReady = false;
export async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  if (isFs()) {
    await fsDriver.ensureBucket();
    bucketReady = true;
    return;
  }
  const Bucket = bucket();
  try {
    await s3Client().send(new HeadBucketCommand({ Bucket }));
  } catch {
    try {
      await s3Client().send(new CreateBucketCommand({ Bucket }));
      logger.info({ Bucket }, 'bucket creado');
    } catch (err) {
      logger.warn({ err, Bucket }, 'no se pudo crear el bucket');
    }
  }
  bucketReady = true;
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await ensureBucket();
  if (isFs()) return fsDriver.putObject(key, body);
  await s3Client().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  if (isFs()) return fsDriver.deleteObject(key);
  await s3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function objectHead(
  key: string,
): Promise<{ size: number; contentType: string | undefined } | null> {
  if (isFs()) return fsDriver.objectHead(key);
  try {
    const res = await s3Client().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return { size: res.ContentLength ?? 0, contentType: res.ContentType };
  } catch {
    return null;
  }
}

/** Lee el objeto completo en memoria (para servirlo en modo fs). */
export async function readObject(key: string): Promise<Buffer | null> {
  if (isFs()) return fsDriver.readObject(key);
  try {
    const res = await s3Client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch {
    return null;
  }
}

export async function presignGet(
  key: string,
  expiresIn = 300,
  downloadName?: string,
): Promise<string> {
  if (isFs()) return fsDriver.presignGet(key);
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ...(downloadName
        ? { ResponseContentDisposition: `attachment; filename="${downloadName}"` }
        : {}),
    }),
    { expiresIn },
  );
}

export async function presignPut(
  key: string,
  contentType: string,
  expiresIn = 900,
): Promise<string> {
  await ensureBucket();
  if (isFs()) return fsDriver.presignPut(key);
  return getSignedUrl(
    s3Client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn },
  );
}
