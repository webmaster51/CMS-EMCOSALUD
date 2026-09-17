/**
 * Aplica las migraciones SQL de ./drizzle.
 * Soporta el driver `pg` (por defecto) y `pglite` (DB_DRIVER=pglite).
 *
 * Uso: `npm run db:migrate`
 */
try {
  process.loadEnvFile('.env');
} catch {
  // En producción las variables vienen del entorno real.
}

const driver = process.env.DB_DRIVER ?? 'pg';

if (driver === 'pglite') {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const client = new PGlite('.data/pglite');
  const db = drizzle(client);
  console.log('Aplicando migraciones (PGlite) desde ./drizzle ...');
  await migrate(db, { migrationsFolder: './drizzle' });
  await client.close();
} else {
  const pg = (await import('pg')).default;
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Falta DATABASE_URL.');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);
  console.log('Aplicando migraciones (PostgreSQL) desde ./drizzle ...');
  await migrate(db, { migrationsFolder: './drizzle' });
  await pool.end();
}

console.log('Migraciones aplicadas correctamente.');
