/// <reference types="astro/client" />

import type { SessionUser, Session } from '@/server/auth/auth';

declare global {
  namespace App {
    interface Locals {
      /** Usuario autenticado, o null si la petición es anónima. */
      user: SessionUser | null;
      /** Sesión activa de Better Auth, o null. */
      session: Session | null;
    }
  }
}

export {};
