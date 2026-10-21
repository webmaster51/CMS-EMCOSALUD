// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Copia el `.env` a process.env para que el código SSR (que lee process.env
// vía src/lib/env.ts) funcione igual en dev, build y en scripts.
const fileEnv = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

// CMS institucional headless y multiportal — EMCO SALUD.
// SSR completo: el panel administrativo y la API viven en el mismo servidor Node.
export default defineConfig({
  site: process.env.APP_URL ?? 'http://localhost:4321',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  
});