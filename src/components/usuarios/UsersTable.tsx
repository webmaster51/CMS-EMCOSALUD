import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { TextField, SelectField } from '@/components/ui/Field';
import { UserForm } from './UserForm';
import type { UserDTO } from '@/lib/dto/user';
import type { PagedDTO } from '@/lib/dto/portal';
import type { UserCreateInput } from '@/lib/validations/user';

interface Props {
  initial: PagedDTO<UserDTO>;
  currentUserId: string;
}

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : 'Nunca';

// 1. Añadimos las etiquetas para los nuevos roles
const ROLE_LABEL = {
  superadmin: 'Superadmin',
  editor: 'Editor',
  document_manager: 'Gestor de Documentos',
  content_manager: 'Gestor de Contenido',
} as const;

// Definimos el tipo de rol basado en las claves del objeto anterior
type UserRoleType = keyof typeof ROLE_LABEL;

export default function UsersTable({ initial, currentUserId }: Props) {
  const [paged, setPaged] = useState(initial);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserDTO | null>(null);
  const [resetting, setResetting] = useState<UserDTO | null>(null);
  const [deleting, setDeleting] = useState<UserDTO | null>(null);
  const [editName, setEditName] = useState('');
  
  // 2. Actualizamos el tipo del estado editRole para aceptar los nuevos roles
  const [editRole, setEditRole] = useState<UserRoleType>('editor');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [newPassword, setNewPassword] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async (page: number, search: string) => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('q', search);
    const res = await apiFetch<PagedDTO<UserDTO>>(`/api/admin/usuarios?${params}`);
    if (res.ok) setPaged(res.data);
    else toast.error(res.error);
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void load(1, q), 300);
    return () => clearTimeout(debounce.current);
  }, [q, load]);

  function openEdit(u: UserDTO) {
    setEditing(u);
    setEditName(u.name);
    setEditRole(u.role as UserRoleType);
    setEditStatus(u.status);
  }

  async function create(values: UserCreateInput) {
    const res = await apiFetch<UserDTO>('/api/admin/usuarios', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Usuario creado');
      setCreating(false);
      void load(1, q);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function saveEdit() {
    if (!editing) return;
    const res = await apiFetch<UserDTO>(`/api/admin/usuarios/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: editName, role: editRole, status: editStatus }),
    });
    if (res.ok) {
      toast.success('Usuario actualizado');
      setEditing(null);
      void load(paged.meta.page, q);
    } else toast.error(res.error);
  }

  async function saveReset() {
    if (!resetting) return;
    const res = await apiFetch(`/api/admin/usuarios/${resetting.id}/password`, {
      method: 'POST',
      body: JSON.stringify({ password: newPassword }),
    });
    if (res.ok) {
      toast.success('Contraseña restablecida (se cerraron sus sesiones)');
      setResetting(null);
      setNewPassword('');
    } else toast.error(res.error);
  }

  async function remove() {
    if (!deleting) return;
    const res = await apiFetch(`/api/admin/usuarios/${deleting.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Usuario eliminado');
      void load(1, q);
    } else toast.error(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="w-72 rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nuevo usuario
        </Button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2.5 font-medium">Usuario</th>
              <th className="px-3 py-2.5 font-medium">Rol</th>
              <th className="px-3 py-2.5 font-medium">Estado</th>
              <th className="px-3 py-2.5 font-medium">Último acceso</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {paged.data.map((u) => {
              const self = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-slate-700">
                      {u.name} {self && <span className="text-xs text-slate-400">(tú)</span>}
                    </div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={u.role === 'superadmin' ? 'brand' : 'neutral'}>
                      {ROLE_LABEL[u.role as UserRoleType] || u.role}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={u.status === 'active' ? 'success' : 'danger'}>
                      {u.status === 'active' ? 'Activo' : 'Suspendido'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{fmt(u.lastLoginAt)}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        title="Editar"
                        onClick={() => openEdit(u)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title="Restablecer contraseña"
                        onClick={() => setResetting(u)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        title="Eliminar"
                        disabled={self}
                        onClick={() => setDeleting(u)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-danger-bg hover:text-danger disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination
          page={paged.meta.page}
          totalPages={paged.meta.totalPages}
          total={paged.meta.total}
          onPage={(page) => void load(page, q)}
        />
      </div>

      <Dialog open={creating} onOpenChange={setCreating} title="Nuevo usuario">
        <UserForm onCancel={() => setCreating(false)} onSubmit={create} />
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={`Editar ${editing?.name ?? ''}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => void saveEdit()}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <TextField label="Nombre" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <SelectField
            label="Rol"
            value={editRole}
            onChange={(e) => setEditRole(e.target.value as UserRoleType)}
            disabled={editing?.id === currentUserId}
          >
            <option value="editor">Editor</option>
            <option value="superadmin">Superadministrador</option>
            {/* 3. Añadimos las opciones visuales para edición */}
            <option value="document_manager">Gestor de Documentos</option>
            <option value="content_manager">Gestor de Contenido</option>
          </SelectField>
          <SelectField
            label="Estado"
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value as 'active' | 'suspended')}
            disabled={editing?.id === currentUserId}
          >
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
          </SelectField>
          {editing?.id === currentUserId && (
            <p className="text-xs text-slate-400">No puedes cambiar tu propio rol ni estado.</p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={resetting !== null}
        onOpenChange={(o) => !o && (setResetting(null), setNewPassword(''))}
        title="Restablecer contraseña"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setResetting(null)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={newPassword.length < 10} onClick={() => void saveReset()}>
              Cambiar contraseña
            </Button>
          </>
        }
      >
        <TextField
          label={`Nueva contraseña para ${resetting?.email ?? ''}`}
          type="text"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          hint="Mínimo 10 caracteres. Se cerrarán todas sus sesiones."
        />
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar usuario"
        message={`¿Eliminar a ${deleting?.name} (${deleting?.email})? Sus contenidos quedarán sin autor.`}
        confirmLabel="Eliminar"
        onConfirm={remove}
      />
    </div>
  );
}