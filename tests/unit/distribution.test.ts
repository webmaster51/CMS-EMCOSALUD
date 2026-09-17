import { describe, expect, it } from 'vitest';
import { distributionSchema, normalizeDistribution } from '@/lib/validations/distribution';
import { boletinInputSchema } from '@/lib/validations/boletin';
import { boardPublicationInputSchema } from '@/lib/validations/boardPublication';
import { trainingInputSchema } from '@/lib/validations/training';
import { popupInputSchema } from '@/lib/validations/popup';
import { bannerInputSchema } from '@/lib/validations/banner';
import { financialStatementInputSchema } from '@/lib/validations/financialStatement';

describe('distributionSchema', () => {
  it('specific requiere exactamente un portal', () => {
    expect(distributionSchema.safeParse({ distributionType: 'specific', portalIds: [1] }).success).toBe(true);
    expect(distributionSchema.safeParse({ distributionType: 'specific', portalIds: [] }).success).toBe(false);
    expect(distributionSchema.safeParse({ distributionType: 'specific', portalIds: [1, 2] }).success).toBe(false);
  });

  it('general requiere al menos un portal', () => {
    expect(distributionSchema.safeParse({ distributionType: 'general', portalIds: [1, 2] }).success).toBe(true);
    expect(distributionSchema.safeParse({ distributionType: 'general', portalIds: [] }).success).toBe(false);
  });

  it('all no exige portales', () => {
    expect(distributionSchema.safeParse({ distributionType: 'all', portalIds: [] }).success).toBe(true);
  });

  it('normalizeDistribution vacía portalIds cuando es "all" y quita duplicados', () => {
    expect(normalizeDistribution({ distributionType: 'all', portalIds: [1, 2] })).toEqual({
      distributionType: 'all',
      portalIds: [],
    });
    expect(normalizeDistribution({ distributionType: 'general', portalIds: [1, 1, 2] })).toEqual({
      distributionType: 'general',
      portalIds: [1, 2],
    });
  });
});

describe('boletinInputSchema', () => {
  const base = {
    title: 'Boletín Q3',
    status: 'draft' as const,
    distributionType: 'general' as const,
    portalIds: [1, 2],
    pdfMediaId: null,
  };

  it('acepta un borrador sin PDF', () => {
    expect(boletinInputSchema.safeParse(base).success).toBe(true);
  });

  it('exige PDF si el estado es publicado', () => {
    const r = boletinInputSchema.safeParse({ ...base, status: 'published' });
    expect(r.success).toBe(false);
  });
});

describe('boardPublicationInputSchema (cartelera)', () => {
  const base = {
    title: 'Cartelera Agosto',
    status: 'draft' as const,
    distributionType: 'all' as const,
    portalIds: [],
    imageMediaId: null,
  };

  it('acepta un borrador sin imagen', () => {
    expect(boardPublicationInputSchema.safeParse(base).success).toBe(true);
  });

  it('exige imagen si el estado es publicado', () => {
    expect(boardPublicationInputSchema.safeParse({ ...base, status: 'published' }).success).toBe(false);
  });

  it('aplica la regla de distribución (general necesita portales)', () => {
    expect(
      boardPublicationInputSchema.safeParse({ ...base, distributionType: 'general', portalIds: [] }).success,
    ).toBe(false);
  });
});

describe('trainingInputSchema (capacitaciones)', () => {
  const base = {
    title: 'Inducción SST',
    status: 'draft' as const,
    distributionType: 'all' as const,
    portalIds: [],
    fileMediaId: null,
  };

  it('acepta un borrador sin archivo', () => {
    expect(trainingInputSchema.safeParse(base).success).toBe(true);
  });

  it('exige archivo si el estado es publicado', () => {
    expect(trainingInputSchema.safeParse({ ...base, status: 'published' }).success).toBe(false);
    expect(
      trainingInputSchema.safeParse({
        ...base,
        status: 'published',
        fileMediaId: '00000000-0000-4000-8000-000000000000',
      }).success,
    ).toBe(true);
  });
});

describe('popupInputSchema', () => {
  const base = {
    internalName: 'Campaña',
    linkType: 'none' as const,
    pageMode: 'all_pages' as const,
    paths: [] as string[],
    status: 'draft' as const,
    priority: 0,
    frequency: 'always' as const,
    frequencyDays: null,
    device: 'all' as const,
    distributionType: 'all' as const,
    portalIds: [] as number[],
  };

  it('acepta un popup mínimo', () => {
    expect(popupInputSchema.safeParse(base).success).toBe(true);
  });

  it('exige URL si el enlace no es "none"', () => {
    expect(popupInputSchema.safeParse({ ...base, linkType: 'external' }).success).toBe(false);
    expect(
      popupInputSchema.safeParse({ ...base, linkType: 'external', url: 'https://x.com' }).success,
    ).toBe(true);
  });

  it('exige rutas si el modo es specific_pages y normaliza el prefijo /', () => {
    expect(popupInputSchema.safeParse({ ...base, pageMode: 'specific_pages' }).success).toBe(false);
    const r = popupInputSchema.safeParse({
      ...base,
      pageMode: 'specific_pages',
      paths: ['servicios/medicina'],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.paths[0]).toBe('/servicios/medicina');
  });

  it('exige frequencyDays con every_x_days y fecha inicial si es programado', () => {
    expect(popupInputSchema.safeParse({ ...base, frequency: 'every_x_days' }).success).toBe(false);
    expect(popupInputSchema.safeParse({ ...base, status: 'scheduled' }).success).toBe(false);
  });
});

describe('bannerInputSchema', () => {
  const base = {
    internalName: 'Campaña salud',
    linkType: 'none' as const,
    sortOrder: 0,
    status: 'draft' as const,
    distributionType: 'all' as const,
    portalIds: [] as number[],
  };

  it('acepta un banner mínimo', () => {
    expect(bannerInputSchema.safeParse(base).success).toBe(true);
  });

  it('exige URL si el enlace no es "none"', () => {
    expect(bannerInputSchema.safeParse({ ...base, linkType: 'external' }).success).toBe(false);
    expect(
      bannerInputSchema.safeParse({ ...base, linkType: 'external', url: 'https://x.com' }).success,
    ).toBe(true);
  });

  it('aplica la regla de distribución (específico = un portal)', () => {
    expect(
      bannerInputSchema.safeParse({ ...base, distributionType: 'specific', portalIds: [1] }).success,
    ).toBe(true);
    expect(
      bannerInputSchema.safeParse({ ...base, distributionType: 'specific', portalIds: [] }).success,
    ).toBe(false);
  });

  it('rechaza fecha final anterior a la inicial', () => {
    expect(
      bannerInputSchema.safeParse({
        ...base,
        startsAt: '2026-01-10T08:00',
        endsAt: '2026-01-01T08:00',
      }).success,
    ).toBe(false);
  });
});

describe('financialStatementInputSchema', () => {
  const base = {
    companyId: 1,
    fiscalYear: 2025,
    status: 'draft' as const,
    files: [] as { label: string; mediaId: string }[],
    distributionType: 'specific' as const,
    portalIds: [1],
  };

  it('acepta un borrador sin documentos', () => {
    expect(financialStatementInputSchema.safeParse(base).success).toBe(true);
  });

  it('exige al menos un documento para publicar', () => {
    expect(
      financialStatementInputSchema.safeParse({ ...base, status: 'published' }).success,
    ).toBe(false);
    expect(
      financialStatementInputSchema.safeParse({
        ...base,
        status: 'published',
        files: [{ label: 'Estado de resultados', mediaId: '00000000-0000-4000-8000-000000000000' }],
      }).success,
    ).toBe(true);
  });

  it('valida el rango del año', () => {
    expect(financialStatementInputSchema.safeParse({ ...base, fiscalYear: 1500 }).success).toBe(
      false,
    );
  });
});
