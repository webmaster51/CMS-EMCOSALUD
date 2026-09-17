/**
 * Sanea el parámetro `next` de la pantalla de login para evitar open redirects.
 * Solo se permiten rutas internas del panel.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/admin'): string {
  if (!raw) return fallback;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  // Debe ser una ruta absoluta interna, sin esquema ni host, y dentro de /admin.
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.includes('\\')) return fallback;
  if (!/^\/admin(\/|$|\?)/.test(value)) return fallback;
  return value;
}
