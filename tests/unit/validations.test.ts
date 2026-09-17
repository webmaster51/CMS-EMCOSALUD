import { describe, expect, it } from 'vitest';
import { slugify, slugSchema } from '@/lib/validations/common';
import { portalInputSchema } from '@/lib/validations/portal';
import { companyInputSchema } from '@/lib/validations/company';

describe('slugify', () => {
  it('normaliza acentos, espacios y mayúsculas', () => {
    expect(slugify('Clínica Emcosalud')).toBe('clinica-emcosalud');
    expect(slugify('  Fundación  ')).toBe('fundacion');
    expect(slugify('Radio / FM 90.5')).toBe('radio-fm-90-5');
  });

  it('produce slugs válidos según slugSchema', () => {
    for (const input of ['EMCOSALUD', 'Escuela FUNAM', 'Área de Salud']) {
      expect(slugSchema.safeParse(slugify(input)).success).toBe(true);
    }
  });
});

describe('portalInputSchema', () => {
  const base = {
    name: 'Farmacia',
    shortName: 'Farmacia',
    slug: 'farmacia',
    url: 'https://farmacia.emcosalud.com',
    status: 'active' as const,
  };

  it('acepta un portal válido', () => {
    expect(portalInputSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza slug con mayúsculas y URL inválida', () => {
    expect(portalInputSchema.safeParse({ ...base, slug: 'Farmacia' }).success).toBe(false);
    expect(portalInputSchema.safeParse({ ...base, url: 'no-es-url' }).success).toBe(false);
  });

  it('permite descripción y deploy hook vacíos', () => {
    const r = portalInputSchema.safeParse({ ...base, description: '', deployHookUrl: '' });
    expect(r.success).toBe(true);
  });
});

describe('companyInputSchema', () => {
  const base = {
    name: 'Sociedad Clínica Emcosalud',
    shortName: 'Clínica',
    taxId: '900123456-7',
    status: 'active' as const,
  };

  it('acepta una empresa válida', () => {
    expect(companyInputSchema.safeParse(base).success).toBe(true);
  });

  it('acepta NIT solo numérico', () => {
    expect(companyInputSchema.safeParse({ ...base, taxId: '860002964' }).success).toBe(true);
  });

  it('rechaza NIT con caracteres no permitidos', () => {
    expect(companyInputSchema.safeParse({ ...base, taxId: '900 123 / 456' }).success).toBe(false);
  });
});
