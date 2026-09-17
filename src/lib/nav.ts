/**
 * Estructura del menú lateral (plan §6). Fuente única para el Sidebar,
 * los breadcrumbs y la comprobación de permisos de navegación.
 */
import type { Resource } from '@/server/auth/permissions';

export interface NavItem {
  label: string;
  href: string;
  resource: Resource;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [{ label: 'Dashboard', href: '/admin', resource: 'dashboard' }],
  },
  {
    label: 'Portales',
    items: [{ label: 'Portales', href: '/admin/portales', resource: 'portales' }],
  },
  {
    label: 'Contenidos',
    items: [
      { label: 'Boletines', href: '/admin/boletines', resource: 'boletines' },
      {
        label: 'Publicaciones de cartelera',
        href: '/admin/publicaciones',
        resource: 'publicaciones',
      },
      { label: 'Blog', href: '/admin/blog', resource: 'blog' },
      { label: 'Capacitaciones', href: '/admin/capacitaciones', resource: 'capacitaciones' },
    ],
  },
  {
    label: 'Documentos',
    items: [
      {
        label: 'Certificados de retenciones',
        href: '/admin/certificados',
        resource: 'certificados',
      },
      {
        label: 'Estados financieros',
        href: '/admin/estados-financieros',
        resource: 'estados-financieros',
      },
      { label: 'Empresas', href: '/admin/empresas', resource: 'empresas' },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { label: 'Banners', href: '/admin/banners', resource: 'banners' },
      { label: 'Popups', href: '/admin/popups', resource: 'popups' },
      { label: 'Multimedia', href: '/admin/multimedia', resource: 'multimedia' },
      { label: 'Usuarios', href: '/admin/usuarios', resource: 'usuarios' },
      { label: 'Configuración', href: '/admin/configuracion', resource: 'configuracion' },
      { label: 'Auditoría', href: '/admin/auditoria', resource: 'auditoria' },
    ],
  },
];

/** Título legible de una ruta admin, para breadcrumbs y <title>. */
export function titleForPath(pathname: string): string {
  for (const group of NAV) {
    for (const item of group.items) {
      if (item.href === pathname) return item.label;
      if (pathname.startsWith(item.href + '/')) return item.label;
    }
  }
  return 'Panel';
}
