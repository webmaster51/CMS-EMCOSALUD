import { publicRoute } from '@/server/api/publicRoute';
import { certificateQuerySchema } from '@/lib/validations/publicApi';
import { findCertificate } from '@/server/services/publicApiService';

export const prerender = false;

/** Consulta puntual de un certificado (empresa NIT + año + documento). */
export const ALL = publicRoute(async ({ context }) => {
  const parsed = certificateQuerySchema.safeParse(
    Object.fromEntries(context.url.searchParams),
  );
  if (!parsed.success) {
    throw new Response(
      JSON.stringify({ error: 'Faltan parámetros: company, year, document' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }
  const cert = await findCertificate(
    parsed.data.company,
    parsed.data.year,
    parsed.data.document,
  );
  if (!cert) {
    throw new Response(JSON.stringify({ error: 'Certificado no encontrado' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  return { body: cert, cache: 'private, no-store' };
});
