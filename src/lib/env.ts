import { z } from 'zod';

/**
 * Validación central de variables de entorno.
 *
 * - En el servidor Astro (dev/build/preview) `astro.config.mjs` copia el `.env`
 *   a `process.env` antes de cargar este módulo.
 * - En scripts (`tsx scripts/*.ts`) cada script llama a `loadDotEnv()` primero.
 * - En producción las variables vienen del entorno real (docker-compose / systemd).
 */

const boolFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:4321'),
  PORT: z.coerce.number().int().positive().default(4321),
  APP_TIMEZONE: z.string().default('America/Bogota'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DATABASE_URL: z
    .string()
    .url()
    .default('postgres://cms:cms@localhost:5432/cms'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  /** `pg` (PostgreSQL real, por defecto) o `pglite` (embebido, solo desarrollo). */
  DB_DRIVER: z.enum(['pg', 'pglite']).default('pg'),

  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET debe tener al menos 16 caracteres'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(8),
  REMEMBER_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** `s3` (MinIO/S3, por defecto) o `fs` (disco local, solo desarrollo sin Docker). */
  STORAGE_DRIVER: z.enum(['s3', 'fs']).default('s3'),
  STORAGE_ENDPOINT: z.string().url().default('http://localhost:9000'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_ACCESS_KEY: z.string().default('minioadmin'),
  STORAGE_SECRET_KEY: z.string().default('minioadmin'),
  STORAGE_BUCKET: z.string().min(1).default('cms-media'),
  STORAGE_PUBLIC_URL: z.string().url().default('http://localhost:4321/media'),
  STORAGE_FORCE_PATH_STYLE: boolFromString.default('true'),

  MAX_FILE_SIZE: z.coerce.number().int().positive().default(52_428_800),
  MAX_BULK_FILES: z.coerce.number().int().positive().default(5000),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: boolFromString.default('false'),
  MAIL_FROM: z.string().default('CMS EMCOSALUD <no-reply@emcosalud.com>'),

  PGBOSS_SCHEMA: z.string().default('pgboss'),
  WEBHOOK_DEBOUNCE_SECONDS: z.coerce.number().int().nonnegative().default(30),

  SEED_SUPERADMIN_EMAIL: z.string().email().optional(),
  SEED_SUPERADMIN_PASSWORD: z.string().optional(),
  SEED_SUPERADMIN_NAME: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Carga `.env` en `process.env` para scripts fuera de Astro. Idempotente. */
export function loadDotEnv(path = '.env'): void {
  try {
    // Node 22+/24: carga y NO sobrescribe variables ya definidas.
    process.loadEnvFile(path);
  } catch {
    // El archivo no existe (p. ej. en CI con env real) — se ignora.
  }
}

export const env: Env = /* lazily via proxy so import order never throws early */ new Proxy(
  {} as Env,
  {
    get(_t, prop: string) {
      return getEnv()[prop as keyof Env];
    },
  },
);
