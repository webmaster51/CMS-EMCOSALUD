import { describe, expect, it } from 'vitest';
import {
  certificateQuerySchema,
  financialStatementsQuerySchema,
  popupsQuerySchema,
  publicListSchema,
} from '@/lib/validations/publicApi';

describe('publicListSchema', () => {
  it('aplica valores por defecto y límites', () => {
    expect(publicListSchema.parse({})).toMatchObject({ page: 1, limit: 20 });
    expect(publicListSchema.safeParse({ limit: '999' }).success).toBe(false);
    expect(publicListSchema.parse({ limit: '50' }).limit).toBe(50);
  });

  it('acepta filtros opcionales', () => {
    const r = publicListSchema.parse({ category: 'salud', tag: 'prevencion', page: '3' });
    expect(r).toMatchObject({ category: 'salud', tag: 'prevencion', page: 3 });
  });
});

describe('popupsQuerySchema', () => {
  it('por defecto path "/" y device "all"', () => {
    expect(popupsQuerySchema.parse({})).toEqual({ path: '/', device: 'all' });
  });
  it('rechaza device inválido', () => {
    expect(popupsQuerySchema.safeParse({ device: 'watch' }).success).toBe(false);
  });
});

describe('financialStatementsQuerySchema', () => {
  it('aplica page/limit por defecto y year opcional', () => {
    expect(financialStatementsQuerySchema.parse({})).toMatchObject({ page: 1, limit: 20 });
    expect(financialStatementsQuerySchema.parse({ year: '2025' }).year).toBe(2025);
    expect(financialStatementsQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('certificateQuerySchema', () => {
  it('exige company, year y document', () => {
    expect(certificateQuerySchema.safeParse({ company: '900123456', year: '2026' }).success).toBe(
      false,
    );
    expect(
      certificateQuerySchema.safeParse({
        company: '900123456-7',
        year: '2026',
        document: '123456789',
      }).success,
    ).toBe(true);
  });
});
