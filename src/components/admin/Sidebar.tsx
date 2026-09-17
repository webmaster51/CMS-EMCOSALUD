import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { NAV } from '@/lib/nav';
import { can, type Role } from '@/server/auth/permissions';
import { cn } from '@/lib/utils/cn';

const COLLAPSE_KEY = 'cms_sidebar_collapsed';

interface Props {
  currentPath: string;
  role: Role;
}

export default function Sidebar({ currentPath, role }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* almacenamiento no disponible */
    }
    const onToggle = () => setMobileOpen((v) => !v);
    window.addEventListener('cms:toggle-sidebar', onToggle);
    return () => window.removeEventListener('cms:toggle-sidebar', onToggle);
  }, []);

  function toggleCollapse() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => can(role, i.resource)),
  })).filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    href === '/admin' ? currentPath === '/admin' : currentPath.startsWith(href);

  const nav = (
    <nav className="space-y-5 px-3 py-4 text-sm">
      {groups.map((section, gi) => (
        <div key={gi}>
          {section.label && !collapsed && (
            <p className="px-2 pb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
              {section.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'block truncate rounded-md px-2 py-1.5',
                    isActive(item.href)
                      ? 'bg-brand-50 font-medium text-brand-700'
                      : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {collapsed ? item.label.charAt(0) : item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Escritorio */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {!collapsed && (
            <span className="font-bold text-brand-700">
              EMCO<span className="text-accent-600">SALUD</span>
            </span>
          )}
          <button
            onClick={toggleCollapse}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
      </aside>

      {/* Móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="font-bold text-brand-700">
                EMCO<span className="text-accent-600">SALUD</span>
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
