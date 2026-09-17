import { defineMiddleware, sequence } from 'astro:middleware';
import { getSession } from '@/lib/auth/session';
import { getEnv } from '@/lib/env';
import { NAV } from '@/lib/nav';
import { can, RESOURCES, type Resource, type Role } from '@/server/auth/permissions';
import { startScheduler } from '@/server/jobs/scheduler';
import { logger } from '@/lib/logger';

// Arranca el planificador de contenido programado una vez por proceso.
startScheduler();

/** Origen desde el que se sirven los archivos (para img-src/media-src del CSP). */
function storageOrigin(): string {
  try {
    return new URL(getEnv().STORAGE_PUBLIC_URL).origin;
  } catch {
    return '';
  }
}

/** Mapa ruta → recurso, derivado del menú (prefijo más largo gana). */
const RESOURCE_BY_PREFIX: ReadonlyArray<readonly [string, Resource]> = [
  ...NAV.flatMap((g) => g.items.map((i) => [i.href, i.resource] as const)),
  ...RESOURCES.map((r) => [`/admin/${r}`, r] as const),
  ...RESOURCES.map((r) => [`/api/admin/${r}`, r] as const),
].sort((a, b) => b[0].length - a[0].length);

function resourceForPath(pathname: string): Resource | null {
  for (const [prefix, resource] of RESOURCE_BY_PREFIX) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return resource;
  }
  return null;
}

/**
 * Cabeceras de seguridad y CORS para peticiones públicas (plan §11).
 */
const securityHeaders = defineMiddleware(async (context, next) => {
  const p = context.url.pathname;

  // Manejo de peticiones previas CORS (Preflight OPTIONS) para la API v1
  if (p.startsWith('/api/v1/') && context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Portal-Slug',
      },
    });
  }

  const response = await next();
  const isDev = import.meta.env.DEV;

  // Permitir consumo Cross-Origin para la API pública
  if (p.startsWith('/api/v1/')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Portal-Slug');
  }

  if (isDev) {
    const store = storageOrigin();
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "worker-src 'self' blob:",
        `img-src 'self' data: blob: https: ${store}`.trim(),
        `connect-src 'self' http://localhost:* ${store} ws:`.trim(),
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
      ].join('; '),
    );
  }

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  );
  if (!isDev) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }
  return response;
});

/** Carga la sesión de Better Auth en `context.locals`. */
const loadSession = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;

  // Better Auth y la API pública gestionan su propia autenticación.
  const p = context.url.pathname;
  if (!p.startsWith('/api/auth/') && !p.startsWith('/api/v1/')) {
    try {
      const data = await getSession(context.request.headers);
      if (data) {
        context.locals.user = data.user;
        context.locals.session = data.session;
      }
    } catch (err) {
      logger.warn({ err }, 'no se pudo cargar la sesión');
    }
  }
  return next();
});

/** Protege las rutas administrativas: exige sesión válida. */
const guardAdminRoutes = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname.startsWith('/api/admin/');

  if (!isAdminPage && !isAdminApi) return next();

  const user = context.locals.user;
  if (!user || user.banned || user.status === 'suspended') {
    if (isAdminApi) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    const next_ = encodeURIComponent(pathname + context.url.search);
    return context.redirect(`/login?next=${next_}`);
  }

  // CSRF: verificación de Origin en mutaciones de la API admin.
  if (isAdminApi && context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    const origin = context.request.headers.get('origin');
    if (origin && origin !== context.url.origin) {
      return new Response(JSON.stringify({ error: 'Origen no permitido' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  // RBAC: comprobación de permiso por recurso.
  const resource = resourceForPath(pathname);
  if (resource && !can(user.role as Role, resource)) {
    if (isAdminApi) {
      return new Response(JSON.stringify({ error: 'Sin permiso' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }
    return context.redirect('/admin?denied=1');
  }

  return next();
});

export const onRequest = sequence(securityHeaders, loadSession, guardAdminRoutes);