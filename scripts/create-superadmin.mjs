/**
 * Crea (o promueve) un superadmin. JS puro.
 *   npm run create:superadmin -- <email> <nombre> <contraseña>
 */
import { randomUUID } from 'node:crypto';
import { hash as argon2Hash } from '@node-rs/argon2';

try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env: se usan las variables del entorno.
}

const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password) {
  console.error('Uso: npm run create:superadmin -- <email> <nombre> <contraseña>');
  process.exit(1);
}
if (password.length < 10) {
  console.error('La contraseña debe tener al menos 10 caracteres.');
  process.exit(1);
}

const driver = process.env.DB_DRIVER ?? 'pg';
let db;
let close = async () => {};
if (driver === 'pglite') {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const client = new PGlite('.data/pglite');
  db = drizzle(client);
  close = () => client.close();
} else {
  const pg = (await import('pg')).default;
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool);
  close = () => pool.end();
}
const { sql } = await import('drizzle-orm');

const [existing] = (await db.execute(sql`select id from users where email = ${email} limit 1`)).rows ?? [];

if (existing) {
  await db.execute(
    sql`update users set role = 'superadmin', status = 'active', banned = false where email = ${email}`,
  );
  const pwHash = await argon2Hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  await db.execute(
    sql`update accounts set password = ${pwHash} where user_id = ${existing.id} and provider_id = 'credential'`,
  );
  console.log(`Usuario ${email} promovido a superadmin y contraseña actualizada.`);
} else {
  const userId = randomUUID();
  const pwHash = await argon2Hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  await db.execute(
    sql`insert into users (id, name, email, email_verified, role, status) values (${userId}, ${name}, ${email}, true, 'superadmin', 'active')`,
  );
  await db.execute(
    sql`insert into accounts (id, user_id, account_id, provider_id, issuer, password) values (${randomUUID()}, ${userId}, ${userId}, 'credential', 'local:credential', ${pwHash})`,
  );
  console.log(`Superadmin ${email} creado.`);
}
await close();
