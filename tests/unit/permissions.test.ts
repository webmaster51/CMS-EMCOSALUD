import { describe, expect, it } from 'vitest';
import { can, assertCan, PermissionError, RESOURCES } from '@/server/auth/permissions';

describe('permisos (RBAC)', () => {
  it('superadmin puede todo', () => {
    for (const r of RESOURCES) {
      expect(can('superadmin', r)).toBe(true);
    }
  });

  it('editor gestiona contenidos y multimedia', () => {
    for (const r of [
      'dashboard',
      'blog',
      'boletines',
      'publicaciones',
      'capacitaciones',
      'certificados',
      'estados-financieros',
      'multimedia',
      'banners',
      'popups',
    ] as const) {
      expect(can('editor', r)).toBe(true);
    }
  });

  it('editor NO accede a administración', () => {
    for (const r of ['portales', 'empresas', 'usuarios', 'configuracion', 'auditoria'] as const) {
      expect(can('editor', r)).toBe(false);
    }
  });

  it('assertCan lanza PermissionError cuando corresponde', () => {
    expect(() => assertCan('editor', 'usuarios')).toThrow(PermissionError);
    expect(() => assertCan('editor', 'blog')).not.toThrow();
  });
});
