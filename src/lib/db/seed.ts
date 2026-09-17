import { db } from './client';
import { users, accounts } from './schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/server/auth/auth'; // Se añade /index para resolver la carpeta en Node ESM

async function main() {
  console.log('🌱 Preparando la base de datos en PostgreSQL...');

  const email = 'admin@emcosalud.com';
  const password = 'Admin12345!';

  // 1. Limpiar registros en PostgreSQL para evitar registros huérfanos
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    console.log('🔄 Limpiando usuario e historial previo...');
    await db.delete(accounts).where(eq(accounts.userId, existingUser.id));
    await db.delete(users).where(eq(users.id, existingUser.id));
  }

  // 2. Registrar el usuario usando la API de Better Auth
  console.log('⏳ Registrando el superadmin mediante la API de Better Auth...');
  
  await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: 'Administrador',
    },
  });

  // 3. Asegurar que el rol quede asignado como 'superadmin' en PostgreSQL
  await db
    .update(users)
    .set({ role: 'superadmin' })
    .where(eq(users.email, email));

  console.log('✅ ¡Usuario SUPERADMIN creado e integrado exitosamente!');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error durante la creación:', err);
    process.exit(1);
  });