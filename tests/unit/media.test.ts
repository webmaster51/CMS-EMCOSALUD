import { describe, expect, it } from 'vitest';
import { validateUpload, buildStorageKey } from '@/lib/storage/media-file';
import { kindForMime } from '@/lib/storage/mime';

// PNG 1×1 transparente
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('validateUpload', () => {
  it('acepta un PNG declarado como image/png', async () => {
    const r = await validateUpload(PNG, 'image/png', 5_000_000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.file.kind).toBe('image');
      expect(r.file.ext).toBe('png');
    }
  });

  it('rechaza cuando el contenido no coincide con el MIME declarado', async () => {
    const r = await validateUpload(PNG, 'application/pdf', 5_000_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('content_mismatch');
  });

  it('rechaza un MIME no permitido', async () => {
    const r = await validateUpload(PNG, 'image/svg+xml', 5_000_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('mime_not_allowed');
  });

  it('rechaza archivos que superan el límite', async () => {
    const r = await validateUpload(PNG, 'image/png', 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('too_large');
  });
});

describe('mime + keys', () => {
  it('clasifica MIME conocidos', () => {
    expect(kindForMime('application/pdf')).toBe('document');
    expect(kindForMime('video/mp4')).toBe('video');
    expect(kindForMime('application/zip')).toBe('archive');
    expect(kindForMime('application/x-cosa-rara')).toBeNull();
  });

  it('genera claves únicas con la forma esperada', () => {
    const a = buildStorageKey('png');
    const b = buildStorageKey('png');
    expect(a).toMatch(/^media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(a).not.toBe(b);
  });
});
