import type { APIContext, APIRoute } from 'astro';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { resolveApiKey, touchApiKey, type ApiKeyContext } from '@/server/auth/apiKey';
import { logger } from '@/lib/logger';

const limiter = new RateLimiterMemory({ points: 120, duration: 60 });

function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'x-api-key, content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function jsonResponse(
  body: unknown,
  init: { status?: number; cors: string; cache?: string; etag?: string },
): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    ...corsHeaders(init.cors),
  };
  if (init.cache) headers['cache-control'] = init.cache;
  if (init.etag) headers.etag = init.etag;
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

async function weakEtag(payload: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `W/"${hex.slice(0, 20)}"`;
}

export interface PublicHandlerArgs {
  context: APIContext;
  apiKey: ApiKeyContext;
  /** slug del portal ya validado. */
  portalSlug: string;
}

/**
 * Envuelve un endpoint de `/api/v1/*`: preflight CORS, autenticación por
 * `x-api-key`, rate limiting, coincidencia opcional de `?portal=`, y cabeceras
 * de caché + ETag sobre el JSON devuelto por `handler`.
 */
export function publicRoute(
  handler: (args: PublicHandlerArgs) => Promise<{ body: unknown; cache?: string }>,
): APIRoute {
  return async (context) => {
    const reqOrigin = context.request.headers.get('origin') ?? '*';

    if (context.request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(reqOrigin) });
    }

    const apiKey = await resolveApiKey(context.request.headers.get('x-api-key'));
    if (!apiKey) {
      return jsonResponse({ error: 'Clave de API no válida' }, { status: 401, cors: reqOrigin });
    }

    const allowOrigin = apiKey.portalUrl || reqOrigin;

    try {
      await limiter.consume(String(apiKey.keyId));
    } catch {
      return jsonResponse(
        { error: 'Demasiadas solicitudes' },
        { status: 429, cors: allowOrigin },
      );
    }

    const requestedPortal = context.url.searchParams.get('portal');
    if (requestedPortal && requestedPortal !== apiKey.portalSlug) {
      return jsonResponse(
        { error: 'El portal solicitado no corresponde a la clave' },
        { status: 403, cors: allowOrigin },
      );
    }

    touchApiKey(apiKey.keyId);

    let result: { body: unknown; cache?: string };
    try {
      result = await handler({ context, apiKey, portalSlug: apiKey.portalSlug });
    } catch (err) {
      if (err instanceof Response) {
        for (const [k, v] of Object.entries(corsHeaders(allowOrigin))) {
          err.headers.set(k, v);
        }
        return err;
      }
      logger.error({ err, path: context.url.pathname }, 'error en API pública');
      return jsonResponse({ error: 'Error interno' }, { status: 500, cors: allowOrigin });
    }

    const payload = JSON.stringify(result.body);
    const etag = await weakEtag(payload);
    if (context.request.headers.get('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: { ...corsHeaders(allowOrigin), etag },
      });
    }

    return jsonResponse(result.body, {
      cors: allowOrigin,
      cache: result.cache ?? 'public, s-maxage=300, stale-while-revalidate=600',
      etag,
    });
  };
}
