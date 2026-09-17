import { describe, expect, it } from 'vitest';
import { userCreateSchema, userUpdateSchema } from '@/lib/validations/user';
import { appSettingsSchema, DEFAULT_SETTINGS } from '@/lib/validations/settings';
import { auditListSchema } from '@/lib/validations/audit';

describe('userCreateSchema', () => {
  const base = {
    name: 'Ana',
    email: 'ana@emcosalud.com',
    password: 'ClaveSegura99',
    role: 'editor' as const,
  };
  it('acepta un usuario válido', () => {
    expect(userCreateSchema.safeParse(base).success).toBe(true);
  });
  it('rechaza contraseña corta y correo inválido', () => {
    expect(userCreateSchema.safeParse({ ...base, password: 'corta' }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...base, email: 'no-es-correo' }).success).toBe(false);
  });
  it('solo admite roles conocidos', () => {
    expect(userCreateSchema.safeParse({ ...base, role: 'root' }).success).toBe(false);
  });
});

describe('userUpdateSchema', () => {
  it('exige nombre, rol y estado', () => {
    expect(userUpdateSchema.safeParse({ name: 'Ana', role: 'editor' }).success).toBe(false);
    expect(
      userUpdateSchema.safeParse({ name: 'Ana', role: 'editor', status: 'active' }).success,
    ).toBe(true);
  });
});

describe('appSettingsSchema', () => {
  it('los valores por defecto son válidos', () => {
    expect(appSettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });
  it('limita defaultPageSize', () => {
    expect(appSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, defaultPageSize: 3 }).success).toBe(
      false,
    );
  });
});

describe('auditListSchema', () => {
  it('parsea filtros opcionales con paginación por defecto', () => {
    const r = auditListSchema.parse({ module: 'usuarios', action: 'create' });
    expect(r).toMatchObject({ page: 1, module: 'usuarios', action: 'create' });
  });
});
