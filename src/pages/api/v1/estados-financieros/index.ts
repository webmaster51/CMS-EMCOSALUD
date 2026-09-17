import { publicRoute } from '@/server/api/publicRoute';
import { financialStatementsQuerySchema } from '@/lib/validations/publicApi';
import { listFinancialStatements } from '@/server/services/publicApiService';

export const prerender = false;

/** Estados financieros publicados de un portal (plan §20). */
export const ALL = publicRoute(async ({ context, portalSlug }) => {
  const q = financialStatementsQuerySchema.parse(Object.fromEntries(context.url.searchParams));
  return {
    body: await listFinancialStatements(portalSlug, q),
    cache: 'public, s-maxage=300, stale-while-revalidate=600',
  };
});
