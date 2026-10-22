import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { ac, roles } from '@/lib/auth/access';
import { getEnv } from '@/lib/env';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { sendMail } from '@/lib/mailer';
import { resetPasswordEmail } from '@/server/auth/emails';

const env = getEnv();

/**
 * Configuración de Better Auth.
 * - Autenticación email + contraseña (hash argon2id).
 * - Sesiones en tabla `sessions`, cookie HttpOnly + Secure.
 * - Plugin `admin`: expone el campo `role` y utilidades de gestión de usuarios.
 * - Recuperación de contraseña por correo (token de un solo uso, expira 1 h).
 */
const isProd = env.NODE_ENV === 'production';

export const auth = betterAuth({
  appName: 'CMS EMCO SALUD',
  // En producción se fija; en desarrollo se infiere de la petición para
  // tolerar que Astro use un puerto distinto al 4321.
  ...(isProd ? { baseURL: env.APP_URL } : {}),
  secret: env.AUTH_SECRET,
  trustedOrigins: isProd
    ? [env.APP_URL]
    : [
        env.APP_URL,
        'http://localhost:4321',
        'http://localhost:4322',
        'http://localhost:4323',
        'http://127.0.0.1:4321',
      ],

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      rateLimit: schema.rateLimits,
    },
  }),

  // Rate limiting persistente (plan §7, §30). El límite estricto para login y
  // recuperación de contraseña protege contra fuerza bruta.
  rateLimit: {
    enabled: true,
    storage: 'database',
    modelName: 'rateLimit',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 900, max: 5 },
      '/request-password-reset': { window: 900, max: 5 },
      '/reset-password': { window: 900, max: 10 },
    },
  },

  user: {
    additionalFields: {
      status: {
        type: 'string',
        required: false,
        defaultValue: 'active',
        input: false,
      },
      lastLoginAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 10,
    autoSignIn: false,
    password: {
      hash: (password) =>
        argon2Hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 }),
      verify: ({ hash, password }) => argon2Verify(hash, password),
    },
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendMail(resetPasswordEmail(user.email, url));
    },
  },

  session: {
    // Vida máxima de la sesión en servidor. Con "Recordar sesión" la cookie
    // persiste hasta este límite; sin recordar, es cookie de sesión (se borra
    // al cerrar el navegador) y Better Auth la caduca antes por inactividad.
    expiresIn: 60 * 60 * 24 * env.REMEMBER_TTL_DAYS,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 60 * env.SESSION_TTL_HOURS,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  advanced: {
    cookiePrefix: 'emcosalud_cms',
    useSecureCookies: env.NODE_ENV === 'production',
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
    },
  },

  plugins: [
    admin({
      ac,
      roles,
      defaultRole: 'editor',
      adminRoles: ['superadmin'],
    }),
  ],
});

export type Auth = typeof auth;
export type SessionUser = Auth['$Infer']['Session']['user'];
export type Session = Auth['$Infer']['Session']['session'];
