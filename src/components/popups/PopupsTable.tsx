import { useCallback, useEffect, useRef, useState } from 'react';
import { MonitorSmartphone, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { PopupForm } from './PopupForm';
import type { PortalOption } from '@/components/forms/PortalSelector';
import type { PopupDTO } from '@/lib/dto/popup';
import type { PagedDTO } from '@/lib/dto/portal';
import type { PopupInput } from '@/lib/validations/popup';

interface Props {
  initial: PagedDTO<PopupDTO>;
  portals: PortalOption[];
}

function distribution(p: PopupDTO): { label: string; tone: 'brand' | 'accent' | 'neutral' } {
  if (p.distributionType === 'all') return { label: 'Todos los portales', tone: 'accent' };
  if (p.distributionType === 'specific')
    return { label: p.portals[0]?.name ?? 'Portal', tone: 'neutral' };
  return { label: `General · ${p.portals.map((x) => x.name).join(', ')}`, tone: 'brand' };
}

const FREQ: Record<string, string> = {
  always: 'Siempre',
  once_session: 'Por sesión',
  once_user: 'Por usuario',
  every_x_days: 'Cada X días',
};

export default function PopupsTable({ initial, portals }: Props) {
  const [paged, setPaged] = useState(initial);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [portalId, setPortalId] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PopupDTO | null>(null);
  const [deleting, setDeleting] = useState<PopupDTO | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(
    async (page: number) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      if (portalId) params.set('portalId', portalId);
      const res = await apiFetch<PagedDTO<PopupDTO>>(`/api/admin/popups?${params}`);
      if (res.ok) setPaged(res.data);
      else toast.error(res.error);
    },
    [q, status, portalId],
  );

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void load(1), 300);
    return () => clearTimeout(debounce.current);
  }, [load]);

  async function create(values: PopupInput) {
    const res = await apiFetch<PopupDTO>('/api/admin/popups', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Popup creado');
      setCreating(false);
      void load(1);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function update(values: PopupInput) {
    if (!editing) return;
    const res = await apiFetch<PopupDTO>(`/api/admin/popups/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Popup actualizado');
      setEditing(null);
      void load(paged.meta.page);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function remove() {
    if (!deleting) return;
    const res = await apiFetch(`/api/admin/popups/${deleting.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Popup eliminado');
      void load(1);
    } else toast.error(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar popup…"
            className="w-52 rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="scheduled">Programado</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="finished">Finalizado</option>
        </select>
        <select
          value={portalId}
          onChange={(e) => setPortalId(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos los portales</option>
          {portals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nuevo popup
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-medium">Popup</th>
                <th className="px-3 py-2.5 font-medium">Distribución</th>
                <th className="px-3 py-2.5 font-medium">Páginas</th>
                <th className="px-3 py-2.5 font-medium">Frecuencia</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 text-right font-medium">Prior.</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {paged.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No hay popups.
                  </td>
                </tr>
              )}
              {paged.data.map((p) => {
                const dist = distribution(p);
                return (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="h-9 w-12 rounded object-cover" />
                        ) : (
                          <span className="grid h-9 w-12 place-items-center rounded bg-slate-100 text-slate-400">
                            <MonitorSmartphone className="h-4 w-4" />
                          </span>
                        )}
                        <div>
                          <div className="font-medium text-slate-700">{p.internalName}</div>
                          {p.title && <div className="text-xs text-slate-400">{p.title}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={dist.tone}>{dist.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {p.pageMode === 'all_pages'
                        ? 'Todas'
                        : `${p.paths.length} ruta${p.paths.length === 1 ? '' : 's'}`}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {FREQ[p.frequency]}
                      {p.frequency === 'every_x_days' && p.frequencyDays
                        ? ` (${p.frequencyDays})`
                        : ''}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                      {p.priority}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(p)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(p)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-danger-bg hover:text-danger"
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
        </div>
        <Pagination
          page={paged.meta.page}
          totalPages={paged.meta.totalPages}
          total={paged.meta.total}
          onPage={(page) => void load(page)}
        />
      </div>

      <Dialog open={creating} onOpenChange={setCreating} title="Nuevo popup" size="lg">
        <PopupForm
          portals={portals}
          submitLabel="Crear popup"
          onCancel={() => setCreating(false)}
          onSubmit={create}
        />
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar popup"
        size="lg"
      >
        {editing && (
          <PopupForm
            portals={portals}
            submitLabel="Guardar cambios"
            defaults={{
              internalName: editing.internalName,
              title: editing.title ?? '',
              subtitle: editing.subtitle ?? '',
              description: editing.description ?? '',
              imageMediaId: editing.imageMediaId,
              mobileImageMediaId: editing.mobileImageMediaId,
              buttonText: editing.buttonText ?? '',
              url: editing.url ?? '',
              linkType: editing.linkType,
              pageMode: editing.pageMode,
              paths: editing.paths,
              startsAt: editing.startsAt ? editing.startsAt.slice(0, 16) : '',
              endsAt: editing.endsAt ? editing.endsAt.slice(0, 16) : '',
              status: editing.status,
              priority: editing.priority,
              frequency: editing.frequency,
              frequencyDays: editing.frequencyDays,
              device: editing.device,
              distributionType: editing.distributionType,
              portalIds: editing.portals.map((x) => x.id),
              image: editing.imageMediaId
                ? { id: editing.imageMediaId, url: editing.imageUrl }
                : null,
              mobileImage: editing.mobileImageMediaId
                ? { id: editing.mobileImageMediaId, url: editing.mobileImageUrl }
                : null,
            }}
            onCancel={() => setEditing(null)}
            onSubmit={update}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar popup"
        message={`¿Eliminar "${deleting?.internalName}"? Dejará de mostrarse en los sitios.`}
        confirmLabel="Eliminar"
        onConfirm={remove}
      />
    </div>
  );
}
