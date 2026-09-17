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
  security: {
    // El middleware valida Origin en las mutaciones; Astro añade su propia
    // comprobación CSRF para formularios con el mismo origen.
    checkOrigin: true,
    // CSP con hashes para los scripts de Astro (solo en el build; en `astro dev`
    // el middleware usa una CSP más laxa). Los estilos permiten 'unsafe-inline'
    // porque Radix/sonner escriben atributos `style=` en runtime.
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
      ],
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
      scriptDirective: { strictDynamic: true },
    },
  },
});
