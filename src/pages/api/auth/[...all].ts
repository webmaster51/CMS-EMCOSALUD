import type { APIRoute } from 'astro';
import { auth } from '@/server/auth/auth';
import { auditAuthResponse } from '@/server/auth/auditAuth';

export const prerender = false;

/** Endpoint de Better Auth: /api/auth/* (login, logout, reset, sesión, admin...). */
export const ALL: APIRoute = async ({ request, clientAddress }) => {
  const response = await auth.handler(request);
  // Auditoría de eventos de acceso (no bloquea la respuesta).
  await auditAuthResponse(request, response, clientAddress);
  return response;
};
