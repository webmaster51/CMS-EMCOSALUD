import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getEnv } from '@/lib/env';
import * as schema from './schema';

/**
 * Instancia Drizzle compartida en todo el servidor (patrón singleton para no
 * agotar conexiones durante el HMR de desarrollo).
 *
 * Driver por defecto: **node-postgres** (PostgreSQL real).
 * Driver alternativo para desarrollo sin Docker: **PGlite** (Postgres embebido),
 * activado con `DB_DRIVER=pglite`. Persiste en `.data/pglite`.
 * PGlite NO sirve para pg-boss ni para producción.
 */
type DrizzleDb = ReturnType<typeof drizzlePg<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __cmsPool?: Pool;
  __cmsDb?: DrizzleDb;
};

const usePglite = getEnv().DB_DRIVER === 'pglite';

let db: DrizzleDb;
let pool: Pool | null = null;

if (globalForDb.__cmsDb) {
  db = globalForDb.__cmsDb;
  pool = globalForDb.__cmsPool ?? null;
} else if (usePglite) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
  const client = new PGlite('.data/pglite');
  db = drizzlePglite(client, {
    schema,
    casing: 'snake_case',
  }) as unknown as DrizzleDb;
} else {
  const env = getEnv();
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
  });
  db = drizzlePg(pool, { schema, casing: 'snake_case' });
}

if (getEnv().NODE_ENV !== 'production') {
  globalForDb.__cmsDb = db;
  if (pool) globalForDb.__cmsPool = pool;
}

export { db, pool, schema };
export type Database = typeof db;
