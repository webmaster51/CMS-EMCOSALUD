import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * Almacenamiento en disco local para desarrollo sin Docker (STORAGE_DRIVER=fs).
 * Guarda los objetos bajo `.data/media/<key>` y los sirve por la ruta
 * `/media/<key>` (ver src/pages/media/[...key].ts).
 * NO usar en producción.
 */
const ROOT = resolve('.data/media');

function pathFor(key: string): string {
  const clean = key.replace(/^\/+/, '').replace(/\.\.(\/|\\)/g, '');
  return join(ROOT, clean);
}

export const fsDriver = {
  async ensureBucket(): Promise<void> {
    await mkdir(ROOT, { recursive: true });
  },

  async putObject(key: string, body: Buffer | Uint8Array): Promise<void> {
    const p = pathFor(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  },

  async deleteObject(key: string): Promise<void> {
    await rm(pathFor(key), { force: true });
  },

  async objectHead(
    key: string,
  ): Promise<{ size: number; contentType: string | undefined } | null> {
    try {
      const s = await stat(pathFor(key));
      return { size: s.size, contentType: undefined };
    } catch {
      return null;
    }
  },

  async readObject(key: string): Promise<Buffer | null> {
    try {
      return await readFile(pathFor(key));
    } catch {
      return null;
    }
  },

  // En modo fs las URLs "prefirmadas" son simplemente la ruta pública.
  async presignGet(key: string): Promise<string> {
    return `${publicBase()}/${key.replace(/^\/+/, '')}`;
  },
  async presignPut(key: string): Promise<string> {
    return `${publicBase()}/${key.replace(/^\/+/, '')}`;
  },
};

function publicBase(): string {
  return (process.env.STORAGE_PUBLIC_URL ?? 'http://localhost:4321/media').replace(/\/$/, '');
}
