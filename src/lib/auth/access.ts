/**
 * Control de acceso de Better Auth (plugin admin).
 *
 * Better Auth exige que cualquier rol usado en `adminRoles` esté declarado aquí.
 * Este módulo es isomórfico: lo importan tanto la configuración del servidor
 * (`src/server/auth/auth.ts`) como el cliente (`src/lib/auth/client.ts`).
 *
 * La autorización fina del CMS vive en `src/server/auth/permissions.ts`
 * (matriz rol × recurso). Aquí solo distinguimos quién es "admin" para las
 * utilidades de gestión de usuarios de Better Auth.
 */
import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access';

export const accessStatement = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(accessStatement);

/** Acceso total, incluidas las operaciones de administración de usuarios. */
export const superadmin = ac.newRole({
  ...adminAc.statements,
});

/** Editor: sin acceso a la gestión de usuarios de Better Auth. */
export const editor = ac.newRole({});

export const roles = { superadmin, editor };
