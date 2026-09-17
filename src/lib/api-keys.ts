import { createHash, randomBytes } from 'node:crypto';

/**
 * Claves de API por portal. Se muestra el valor en claro UNA sola vez al crearla;
 * en la base de datos solo se guarda el hash SHA-256 y un prefijo para identificarla.
 */

export interface GeneratedApiKey {
  /** Valor en claro — mostrar al usuario una única vez. */
  plaintext: string;
  hash: string;
  prefix: string;
}

export function generateApiKey(portalSlug: string): GeneratedApiKey {
  const secret = randomBytes(24).toString('base64url');
  const plaintext = `emc_${portalSlug}_${secret}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, 12),
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}
