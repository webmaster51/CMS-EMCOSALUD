import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Si existe DATABASE_URL la usa; si no, por defecto apunta a localhost para desarrollo local
    url: process.env.DATABASE_URL || 'postgres://cms:cms_password_seguro@localhost:5432/cms_emcosalud',
  },
});