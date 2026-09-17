import type { APIContext } from 'astro';
import { auth } from '@/server/auth/auth';
import {
  assertCan,
  PermissionError,
  type Action,
  type Resource,
  type Role,
} from '@/server/auth/permissions';
import type { SessionUser } from '@/server/auth/auth';

/** Devuelve la sesión de Better Auth a partir de las cabeceras de la petición. */
export async function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

export type AuthedUser = Omit<SessionUser, 'role'> & { role: Role };

/**
 * Garantiza que hay un usuario autenticado y activo.
 * Lanza una `Response` (redirect o 401) si no lo hay — pensado para usarse en
 * páginas `.astro` y endpoints con `return await requireUser(context)`.
 */
export async function requireUser(
  context: APIContext,
  opts: { json?: boolean } = {},
): Promise<AuthedUser> {
  const user = context.locals.user;
  if (!user || user.banned || user.status === 'suspended') {
    if (opts.json) {
      throw new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    const to = encodeURIComponent(context.url.pathname + context.url.search);
    throw context.redirect(`/login?next=${to}`);
  }
  return user as AuthedUser;
}

/**
 * Exige usuario autenticado **y** permiso sobre un recurso.
 * En páginas: redirige a /login (sin sesión) o /admin (sin permiso).
 * En endpoints (`json: true`): responde 401 / 403.
 */
export async function requireResource(
  context: APIContext,
  resource: Resource,
  action: Action = 'view',
  opts: { json?: boolean } = {},
): Promise<AuthedUser> {
  const user = await requireUser(context, opts);
  try {
    assertCan(user.role, resource, action);
  } catch (err) {
    if (err instanceof PermissionError) {
      if (opts.json) {
        throw new Response(JSON.stringify({ error: err.message }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw context.redirect('/admin?denied=1');
    }
    throw err;
  }
  return user;
}
