/**
 * Matriz de permisos rol × recurso × acción (plan §10).
 * Dos roles fijos: `superadmin` (todo) y `editor` (contenidos + multimedia).
 * No vive en base de datos: es política de la aplicación.
 */
export type Role = 'superadmin' | 'editor';

export const RESOURCES = [
  'dashboard',
  'blog',
  'boletines',
  'publicaciones',
  'capacitaciones',
  'certificados',
  'estados-financieros',
  'empresas',
  'multimedia',
  'banners',
  'popups',
  'portales',
  'usuarios',
  'configuracion',
  'auditoria',
] as const;
export type Resource = (typeof RESOURCES)[number];

export type Action = 'view' | 'create' | 'update' | 'delete' | 'publish' | 'manage';

/** Recursos que solo el superadmin puede tocar. */
const SUPERADMIN_ONLY: ReadonlySet<Resource> = new Set([
  'empresas',
  'portales',
  'usuarios',
  'configuracion',
  'auditoria',
]);

/** Recursos de contenido que el editor gestiona por completo. */
const EDITOR_CONTENT: ReadonlySet<Resource> = new Set([
  'dashboard',
  'blog',
  'boletines',
  'publicaciones',
  'capacitaciones',
  'certificados',
  'estados-financieros',
  'multimedia',
  'banners',
  'popups',
]);

export function can(role: Role, resource: Resource, _action: Action = 'view'): boolean {
  if (role === 'superadmin') return true;
  if (role === 'editor') {
    if (SUPERADMIN_ONLY.has(resource)) return false;
    return EDITOR_CONTENT.has(resource);
  }
  return false;
}

export function assertCan(role: Role, resource: Resource, action: Action = 'view'): void {
  if (!can(role, resource, action)) {
    throw new PermissionError(role, resource, action);
  }
}

export class PermissionError extends Error {
  readonly status = 403;
  constructor(
    readonly role: Role,
    readonly resource: Resource,
    readonly action: Action,
  ) {
    super(`El rol "${role}" no puede "${action}" sobre "${resource}".`);
    this.name = 'PermissionError';
  }
}
