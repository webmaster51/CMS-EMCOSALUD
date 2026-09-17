import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { recordAudit, clientIp } from '@/server/services/auditService';
import { logger } from '@/lib/logger';

/**
 * Observa las respuestas del handler de Better Auth y registra en auditoría los
 * eventos de acceso (plan §29): inicio de sesión, intento fallido, cierre de
 * sesión y restablecimiento de contraseña. También actualiza `users.last_login_at`.
 *
 * No bloquea ni altera la respuesta: si algo falla, solo se registra en el log.
 */
export async function auditAuthResponse(
  request: Request,
  response: Response,
  clientAddress?: string,
): Promise<void> {
  try {
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    const endpoint = path.slice(path.indexOf('/api/auth/') + '/api/auth/'.length);
    const ok = response.status >= 200 && response.status < 300;
    const ip = clientIp(request.headers) ?? clientAddress ?? null;
    const userAgent = request.headers.get('user-agent');

    if (endpoint === 'sign-in/email') {
      if (ok) {
        const body = (await response.clone().json().catch(() => null)) as {
          user?: { id?: string; email?: string };
        } | null;
        const user = body?.user;
        if (user?.id) {
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, user.id));
        }
        await recordAudit({
          userId: user?.id ?? null,
          action: 'login',
          module: 'auth',
          summary: `${user?.email ?? 'Un usuario'} inició sesión`,
          ip,
          userAgent,
        });
      } else {
        const attempted = await readEmail(request);
        await recordAudit({
          action: 'login_failed',
          module: 'auth',
          summary: `Intento de inicio de sesión fallido${attempted ? ` para ${attempted}` : ''}`,
          metadata: { status: response.status },
          ip,
          userAgent,
        });
      }
      return;
    }

    if (endpoint === 'sign-out' && ok) {
      await recordAudit({
        action: 'logout',
        module: 'auth',
        summary: 'Cierre de sesión',
        ip,
        userAgent,
      });
      return;
    }

    if (endpoint === 'request-password-reset' && ok) {
      const email = await readEmail(request);
      await recordAudit({
        action: 'password_reset_requested',
        module: 'auth',
        summary: `Solicitud de restablecimiento de contraseña${email ? ` para ${email}` : ''}`,
        ip,
        userAgent,
      });
      return;
    }

    if (endpoint === 'reset-password' && ok) {
      await recordAudit({
        action: 'password_reset',
        module: 'auth',
        summary: 'Contraseña restablecida',
        ip,
        userAgent,
      });
    }
  } catch (err) {
    logger.error({ err }, 'fallo en auditoría de autenticación');
  }
}

async function readEmail(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { email?: string };
    return typeof body.email === 'string' ? body.email : null;
  } catch {
    return null;
  }
}
