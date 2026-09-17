/**
 * Reinicia el entorno LOCAL de desarrollo (solo DB_DRIVER=pglite / STORAGE_DRIVER=fs):
 * borra la base de datos embebida y los archivos locales, vuelve a migrar y siembra.
 *
 * Durante el desarrollo activo el esquema se regenera como una sola migración
 * (`drizzle/0000_init.sql`); este script evita tener que borrar `.data` a mano.
 *
 * Uso: `npm run db:reset`
 */
import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

try {
  process.loadEnvFile('.env');
} catch {
  /* sin .env */
}

if ((process.env.DB_DRIVER ?? 'pg') !== 'pglite') {
  console.error('db:reset solo aplica con DB_DRIVER=pglite. Para PostgreSQL usa migraciones.');
  process.exit(1);
}

console.log('Borrando .data/pglite y .data/media …');
await rm('.data/pglite', { recursive: true, force: true });
await rm('.data/media', { recursive: true, force: true });

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run('node', ['scripts/migrate.mjs']);
run('node', ['scripts/seed.mjs']);
console.log('\nEntorno local reiniciado.');
