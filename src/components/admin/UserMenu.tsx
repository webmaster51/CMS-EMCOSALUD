import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Settings, UserRound } from 'lucide-react';
import { signOut } from '@/lib/auth/client';

interface Props {
  name: string;
  email: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Superadministrador',
  editor: 'Editor',
};

export default function UserMenu({ name, email, role }: Props) {
  async function logout() {
    await signOut();
    window.location.href = '/login?reason=loggedout';
  }

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 rounded-full outline-none">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {initials || <UserRound className="h-4 w-4" />}
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[13rem] rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-slate-800">{name}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
            <p className="mt-0.5 text-xs text-brand-600">{ROLE_LABEL[role] ?? role}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          <DropdownMenu.Item
            asChild
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
          >
            <a href="/admin/configuracion">
              <Settings className="h-4 w-4" /> Configuración
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={logout}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger outline-none data-[highlighted]:bg-danger-bg"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
