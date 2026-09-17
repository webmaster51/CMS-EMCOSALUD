/**
 * Datos semilla — JS puro (no depende de tsx ni de better-auth), apto para la
 * imagen de producción. Idempotente.
 *
 *   npm run seed
 *
 * Crea: portales base, empresas de ejemplo, patrones de nombre de certificados y
 * el superadmin inicial (SEED_SUPERADMIN_* del entorno).
 */
import { randomUUID } from 'node:crypto';
import { hash as argon2Hash } from '@node-rs/argon2';

try {
  process.loadEnvFile('.env');
} catch {
  /* variables del entorno real */
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

async function one(query) {
  const r = await db.execute(query);
  return r.rows?.[0] ?? r[0];
}

async function upsertPortal(p) {
  const existing = await one(sql`select id from portals where slug = ${p.slug} limit 1`);
  if (existing) return;
  await db.execute(sql`
    insert into portals (name, short_name, slug, url, description, status)
    values (${p.name}, ${p.shortName}, ${p.slug}, ${p.url}, ${p.description}, 'active')
  `);
  console.log('  portal +', p.slug);
}

async function upsertCompany(c) {
  const existing = await one(sql`select id from companies where tax_id = ${c.taxId} limit 1`);
  if (existing) return;
  await db.execute(sql`
    insert into companies (name, short_name, tax_id, status)
    values (${c.name}, ${c.shortName}, ${c.taxId}, 'active')
  `);
  console.log('  empresa +', c.shortName);
}

async function upsertPattern(p) {
  const existing = await one(
    sql`select id from certificate_filename_patterns where name = ${p.name} limit 1`,
  );
  if (existing) return;
  await db.execute(sql`
    insert into certificate_filename_patterns (name, regex, document_group, year_group, is_default, enabled)
    values (${p.name}, ${p.regex}, ${p.documentGroup}, ${p.yearGroup}, ${p.isDefault}, true)
  `);
  console.log('  patrón +', p.name);
}

async function seedSuperadmin() {
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  const name = process.env.SEED_SUPERADMIN_NAME ?? 'Administrador';
  if (!email || !password) {
    console.log('  (sin SEED_SUPERADMIN_EMAIL/PASSWORD — se omite el superadmin)');
    return;
  }
  const existing = await one(sql`select id from users where email = ${email} limit 1`);
  if (existing) {
    console.log('  superadmin ya existe:', email);
    return;
  }
  const userId = randomUUID();
  const pwHash = await argon2Hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  await db.execute(sql`
    insert into users (id, name, email, email_verified, role, status)
    values (${userId}, ${name}, ${email}, true, 'superadmin', 'active')
  `);
  await db.execute(sql`
    insert into accounts (id, user_id, account_id, provider_id, issuer, password)
    values (${randomUUID()}, ${userId}, ${userId}, 'credential', 'local:credential', ${pwHash})
  `);
  console.log('  superadmin +', email);
}

console.log('Sembrando datos base…');
for (const p of [
  { name: 'EMCOSALUD', shortName: 'Emcosalud', slug: 'emcosalud', url: 'https://emcosalud.com', description: 'Portal institucional de EMCOSALUD.' },
  { name: 'Clínica Emcosalud', shortName: 'Clínica', slug: 'clinica', url: 'https://clinicaemcosalud.com', description: 'Sitio de la Clínica Emcosalud.' },
  { name: 'Escuela FUNAM', shortName: 'Escuela', slug: 'escuela', url: 'https://www.funam.edu.co', description: 'Fundación Universitaria — Escuela.' },
  { name: 'Radio Emcosalud', shortName: 'Radio', slug: 'radio', url: 'https://radio.emcosalud.com', description: 'Emisora institucional.' },
]) await upsertPortal(p);

for (const c of [
  { name: 'EMCOSALUD', shortName: 'Emcosalud', taxId: '900000000-1' },
  { name: 'Sociedad Clínica Emcosalud', shortName: 'Clínica', taxId: '900000000-2' },
]) await upsertCompany(c);

for (const p of [
  { name: 'Documento al inicio (123456789-...)', regex: '^(?<doc>\\d{6,15})[-_ ].*', documentGroup: 'doc', yearGroup: null, isDefault: true },
  { name: 'CC_documento_año (CC_123456789_2026.pdf)', regex: '^CC[_-](?<doc>\\d{6,15})[_-](?<year>\\d{4})', documentGroup: 'doc', yearGroup: 'year', isDefault: false },
  { name: 'Solo dígitos (123456789.pdf)', regex: '^(?<doc>\\d{6,15})\\.pdf$', documentGroup: 'doc', yearGroup: null, isDefault: false },
]) await upsertPattern(p);

await seedSuperadmin();
console.log('Listo.');
await close();
