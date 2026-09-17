import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { PortalForm } from './PortalForm';
import type { PagedDTO, PortalDTO } from '@/lib/dto/portal';
import type { PortalInput } from '@/lib/validations/portal';

interface Props {
  initial: PagedDTO<PortalDTO>;
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso));

export default function PortalsTable({ initial }: Props) {
  const [paged, setPaged] = useState(initial);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PortalDTO | null>(null);
  const [deleting, setDeleting] = useState<PortalDTO | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async (page: number, search: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('q', search);
    const res = await apiFetch<PagedDTO<PortalDTO>>(`/api/admin/portales?${params}`);
    setLoading(false);
    if (res.ok) setPaged(res.data);
    else toast.error(res.error);
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void load(1, q), 300);
    return () => clearTimeout(debounce.current);
  }, [q, load]);

  async function createPortal(values: PortalInput) {
    const res = await apiFetch<PortalDTO>('/api/admin/portales', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Portal creado');
      setCreating(false);
      void load(1, q);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function updatePortal(values: PortalInput) {
    if (!editing) return;
    const res = await apiFetch<PortalDTO>(`/api/admin/portales/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Portal actualizado');
      setEditing(null);
      void load(paged.meta.page, q);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function removePortal() {
    if (!deleting) return;
    const res = await apiFetch(`/api/admin/portales/${deleting.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Portal eliminado');
      void load(1, q);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar portal…"
            className="w-64 rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nuevo portal
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-medium">Portal</th>
                <th className="px-3 py-2.5 font-medium">Slug</th>
                <th className="px-3 py-2.5 font-medium">URL</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 text-right font-medium">Claves</th>
                <th className="px-3 py-2.5 font-medium">Creado</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {paged.data.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No hay portales que coincidan.
                  </td>
                </tr>
              )}
              {paged.data.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {p.logoUrl ? (
                        <img
                          src={p.logoUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-slate-100 text-xs font-semibold text-slate-400">
                          {p.shortName.charAt(0)}
                        </span>
                      )}
                      <div>
                        <div className="font-medium text-slate-700">{p.name}</div>
                        <div className="text-xs text-slate-400">{p.shortName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{p.slug}</code>
                  </td>
                  <td className="px-3 py-2.5">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      {p.url.replace(/^https?:\/\//, '')}
                    </a>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>
                      {p.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.apiKeyCount}</td>
                  <td className="px-3 py-2.5 text-slate-500">{fmtDate(p.createdAt)}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <a
                        href={`/admin/portales/${p.id}`}
                        title="Claves de API"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <KeyRound className="h-4 w-4" />
                      </a>
                      <button
                        title="Editar"
                        onClick={() => setEditing(p)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => setDeleting(p)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-danger-bg hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={paged.meta.page}
          totalPages={paged.meta.totalPages}
          total={paged.meta.total}
          onPage={(page) => void load(page, q)}
        />
      </div>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="Nuevo portal"
        description="El slug se usa en las llamadas a la API (?portal=slug)."
      >
        <PortalForm
          submitLabel="Crear portal"
          onCancel={() => setCreating(false)}
          onSubmit={createPortal}
        />
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={`Editar ${editing?.name ?? ''}`}
      >
        {editing && (
          <PortalForm
            submitLabel="Guardar cambios"
            logoPreviewUrl={editing.logoUrl}
            defaultValues={{
              name: editing.name,
              shortName: editing.shortName,
              slug: editing.slug,
              url: editing.url,
              description: editing.description ?? '',
              status: editing.status,
              deployHookUrl: editing.deployHookUrl ?? '',
              logoMediaId: editing.logoMediaId,
            }}
            onCancel={() => setEditing(null)}
            onSubmit={updatePortal}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar portal"
        message={`¿Eliminar "${deleting?.name}"? Esta acción no se puede deshacer. Si el portal tiene contenidos asociados, desactívalo en su lugar.`}
        confirmLabel="Eliminar"
        onConfirm={removePortal}
      />
    </div>
  );
}
