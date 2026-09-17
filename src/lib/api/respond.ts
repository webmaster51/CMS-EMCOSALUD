import type { APIContext } from 'astro';
import type { ZodType } from 'zod';
import { clientIp } from '@/server/services/auditService';
import type { ServiceResult } from '@/server/services/result';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Traduce un ServiceResult a Response. */
export function fromResult<T>(result: ServiceResult<T>, okStatus = 200): Response {
  if (result.ok) return json(result.data, okStatus);
  return json({ error: result.error, fieldErrors: result.fieldErrors }, result.status);
}

/** Lee y valida el cuerpo JSON. Devuelve los datos o una Response 400. */
export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: json({ error: 'JSON inválido' }, 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      fieldErrors[key] ??= issue.message;
    }
    return {
      ok: false,
      response: json({ error: 'Datos no válidos', fieldErrors }, 400),
    };
  }
  return { ok: true, data: parsed.data };
}

export function actorFrom(context: APIContext): {
  userId: string;
  ip: string | null;
  userAgent: string | null;
} {
  return {
    userId: context.locals.user?.id ?? '',
    ip: clientIp(context.request.headers) ?? context.clientAddress ?? null,
    userAgent: context.request.headers.get('user-agent'),
  };
}

/** Convierte un parámetro de ruta en entero positivo o null. */
export function intParam(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
