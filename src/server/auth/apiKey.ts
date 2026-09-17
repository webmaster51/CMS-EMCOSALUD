import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { apiKeys, portals } from '@/lib/db/schema';
import { hashApiKey } from '@/lib/api-keys';

export interface ApiKeyContext {
  keyId: number;
  portalId: number;
  portalSlug: string;
  portalName: string;
  portalUrl: string;
}

const cache = new Map<string, { ctx: ApiKeyContext; at: number }>();
const TTL = 30_000;

/** Resuelve una clave `x-api-key` a su portal. Devuelve null si no es válida. */
export async function resolveApiKey(raw: string | null): Promise<ApiKeyContext | null> {
  if (!raw || raw.length < 10) return null;
  const hash = hashApiKey(raw.trim());

  const cached = cache.get(hash);
  if (cached && Date.now() - cached.at < TTL) return cached.ctx;

  const [row] = await db
    .select({
      keyId: apiKeys.id,
      portalId: portals.id,
      portalSlug: portals.slug,
      portalName: portals.name,
      portalUrl: portals.url,
      portalStatus: portals.status,
    })
    .from(apiKeys)
    .innerJoin(portals, eq(portals.id, apiKeys.portalId))
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row || row.portalStatus !== 'active') return null;

  const ctx: ApiKeyContext = {
    keyId: row.keyId,
    portalId: row.portalId,
    portalSlug: row.portalSlug,
    portalName: row.portalName,
    portalUrl: row.portalUrl,
  };
  cache.set(hash, { ctx, at: Date.now() });
  return ctx;
}

/** Marca la clave como usada (sin bloquear la respuesta). */
export function touchApiKey(keyId: number): void {
  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, keyId))
    .catch(() => undefined);
}
