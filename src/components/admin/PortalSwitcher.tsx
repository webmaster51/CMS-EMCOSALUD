import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronsUpDown, Globe } from 'lucide-react';
import { PORTAL_COOKIE } from '@/lib/portal-context';

interface PortalOpt {
  slug: string;
  name: string;
  shortName: string;
}

interface Props {
  portals: PortalOpt[];
  current: string | null;
}

function select(slug: string | null) {
  const value = slug ?? '__all__';
  document.cookie = `${PORTAL_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  // Recarga la vista actual sin query para que el SSR relea la cookie.
  window.location.assign(window.location.pathname);
}

export default function PortalSwitcher({ portals, current }: Props) {
  const active = portals.find((p) => p.slug === current);
  const label = active ? active.name : 'Todos los portales';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <Globe className="h-4 w-4 text-brand-600" />
        <span className="max-w-[10rem] truncate">{label}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[14rem] rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          <DropdownMenu.Item
            onSelect={() => select(null)}
            className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
          >
            Todos los portales
            {current === null && <Check className="h-4 w-4 text-brand-600" />}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          {portals.map((p) => (
            <DropdownMenu.Item
              key={p.slug}
              onSelect={() => select(p.slug)}
              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
            >
              {p.name}
              {current === p.slug && <Check className="h-4 w-4 text-brand-600" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
