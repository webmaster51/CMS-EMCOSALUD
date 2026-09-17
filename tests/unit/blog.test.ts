import { describe, expect, it } from 'vitest';
import { blogInputSchema } from '@/lib/validations/blog';
import { sanitizeBlogHtml, htmlToText } from '@/lib/html-sanitize';

const base = {
  title: 'Campaña de prevención',
  slug: 'campana-de-prevencion',
  tagNames: [],
  status: 'draft' as const,
  distributionType: 'all' as const,
  portalIds: [],
  contentHtml: '',
};

describe('blogInputSchema', () => {
  it('acepta un borrador mínimo', () => {
    expect(blogInputSchema.safeParse(base).success).toBe(true);
  });

  it('exige contenido si se publica', () => {
    expect(blogInputSchema.safeParse({ ...base, status: 'published' }).success).toBe(false);
    expect(
      blogInputSchema.safeParse({ ...base, status: 'published', contentHtml: '<p>hola</p>' }).success,
    ).toBe(true);
  });

  it('programado exige fecha futura', () => {
    expect(
      blogInputSchema.safeParse({
        ...base,
        status: 'scheduled',
        contentHtml: '<p>x</p>',
        scheduleAt: '2020-01-01T10:00',
      }).success,
    ).toBe(false);
    expect(
      blogInputSchema.safeParse({
        ...base,
        status: 'scheduled',
        contentHtml: '<p>x</p>',
        scheduleAt: '2099-01-01T10:00',
      }).success,
    ).toBe(true);
  });

  it('rechaza slug con mayúsculas', () => {
    expect(blogInputSchema.safeParse({ ...base, slug: 'Campana' }).success).toBe(false);
  });
});

describe('sanitizeBlogHtml', () => {
  it('elimina scripts, imágenes y atributos peligrosos', () => {
    const dirty =
      '<h2>Hola</h2><p onclick="x()">Texto</p><script>alert(1)</script><img src=x onerror=alert(2)>';
    const clean = sanitizeBlogHtml(dirty);
    expect(clean).toContain('<h2>Hola</h2>');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('<img');
  });

  it('fuerza rel seguro en los enlaces', () => {
    const clean = sanitizeBlogHtml('<a href="https://x.com">x</a>');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });

  it('htmlToText devuelve texto plano', () => {
    expect(htmlToText('<h2>Hola</h2><p>mundo</p>')).toBe('Hola mundo');
  });
});
