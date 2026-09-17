import { describe, expect, it } from 'vitest';
import {
  orderPatterns,
  parseCertificateFilename,
  type FilenamePattern,
} from '@/lib/certificates/filename-parser';
import { normalizeFilename } from '@/lib/certificates/csv-parser';

// Patrones equivalentes a los del seed.
const patterns: FilenamePattern[] = [
  { id: 1, regex: '^(?<doc>\\d{6,15})[-_ ].*', documentGroup: 'doc', yearGroup: null },
  { id: 2, regex: '^CC[_-](?<doc>\\d{6,15})[_-](?<year>\\d{4})', documentGroup: 'doc', yearGroup: 'year' },
  { id: 3, regex: '^(?<doc>\\d{6,15})\\.pdf$', documentGroup: 'doc', yearGroup: null },
];

describe('parseCertificateFilename', () => {
  it('detecta el documento al inicio', () => {
    expect(parseCertificateFilename('123456789-certificado.pdf', patterns, 2026)).toEqual({
      document: '123456789',
      year: 2026,
      patternId: 1,
    });
  });

  it('detecta documento y año en CC_doc_año', () => {
    expect(parseCertificateFilename('CC_987654321_2025.pdf', patterns, 2026)).toEqual({
      document: '987654321',
      year: 2025,
      patternId: 2,
    });
  });

  it('detecta solo dígitos', () => {
    expect(parseCertificateFilename('555555555.pdf', patterns, 2026)).toEqual({
      document: '555555555',
      year: 2026,
      patternId: 3,
    });
  });

  it('usa el fallback de dígitos cuando ningún patrón acierta', () => {
    const r = parseCertificateFilename('CC-111222333-retencion.pdf', patterns, 2026);
    expect(r.document).toBe('111222333');
    expect(r.year).toBe(2026);
    expect(r.patternId).toBeNull();
  });

  it('devuelve null si no hay dígitos', () => {
    expect(parseCertificateFilename('sin-numero.pdf', patterns, 2026).document).toBeNull();
  });

  it('ignora la ruta del archivo', () => {
    expect(parseCertificateFilename('carpeta/sub/123456789_x.pdf', patterns, 2026).document).toBe(
      '123456789',
    );
  });
});

describe('orderPatterns / normalizeFilename', () => {
  it('pone primero el patrón preferido', () => {
    expect(orderPatterns(patterns, 3).map((p) => p.id)).toEqual([3, 1, 2]);
  });
  it('normaliza nombres de archivo', () => {
    expect(normalizeFilename('C:\\ruta\\Archivo.PDF')).toBe('archivo.pdf');
  });
});
