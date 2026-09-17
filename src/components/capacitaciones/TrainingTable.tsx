import { useCallback, useEffect, useRef, useState } from 'react';
import { GraduationCap, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { MediaIcon } from '@/components/multimedia/mediaIcon';
import { TrainingForm } from './TrainingForm';
import type { PortalOption } from '@/components/forms/PortalSelector';
import type { TrainingDTO } from '@/lib/dto/training';
import type { PagedDTO } from '@/lib/dto/portal';
import type { TrainingInput } from '@/lib/validations/training';

interface Props {
  initial: PagedDTO<TrainingDTO>;
  portals: PortalOption[];
}

const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso)) : '—';

function distribution(b: TrainingDTO): { label: string; tone: 'brand' | 'accent' | 'neutral' } {
  if (b.distributionType === 'all') return { label: 'Todos los portales', tone: 'accent' };
  if (b.distributionType === 'specific')
    return { label: b.portals[0]?.name ?? 'Portal', tone: 'neutral' };
  return { label: `General · ${b.portals.map((p) => p.name).join(', ')}`, tone: 'brand' };
}

export default function TrainingTable({ initial, portals }: Props) {
  const [paged, setPaged] = useState(initial);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [portalId, setPortalId] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TrainingDTO | null>(null);
  const [deleting, setDeleting] = useState<TrainingDTO | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(
    async (page: number) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      if (portalId) params.set('portalId', portalId);
      const res = await apiFetch<PagedDTO<TrainingDTO>>(`/api/admin/capacitaciones?${params}`);
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

  async function create(values: TrainingInput) {
    const res = await apiFetch<TrainingDTO>('/api/admin/capacitaciones', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Capacitación creada');
      setCreating(false);
      void load(1);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function update(values: TrainingInput) {
    if (!editing) return;
    const res = await apiFetch<TrainingDTO>(`/api/admin/capacitaciones/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Capacitación actualizada');
      setEditing(null);
      void load(paged.meta.page);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function remove() {
    if (!deleting) return;
    const res = await apiFetch(`/api/admin/capacitaciones/${deleting.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Capacitación eliminada');
      void load(1);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="w-56 rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
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
          <Plus className="h-4 w-4" /> Nueva capacitación
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-medium">Capacitación</th>
                <th className="px-3 py-2.5 font-medium">Distribución</th>
                <th className="px-3 py-2.5 font-medium">Categoría</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 font-medium">Fecha</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {paged.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    No hay capacitaciones.
                  </td>
                </tr>
              )}
              {paged.data.map((b) => {
                const dist = distribution(b);
                return (
                  <tr key={b.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {b.imageUrl ? (
                          <img src={b.imageUrl} alt="" className="h-9 w-9 rounded object-cover" />
                        ) : (
                          <span className="grid h-9 w-9 place-items-center rounded bg-slate-100 text-slate-400">
                            {b.fileKind ? (
                              <MediaIcon kind={b.fileKind} className="h-4 w-4" />
                            ) : (
                              <GraduationCap className="h-4 w-4" />
                            )}
                          </span>
                        )}
                        <span className="font-medium text-slate-700">{b.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={dist.tone}>{dist.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{b.categoryName ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{fmtDate(b.publishedDate)}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          title="Editar"
                          onClick={() => setEditing(b)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title="Eliminar"
                          onClick={() => setDeleting(b)}
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

      <Dialog open={creating} onOpenChange={setCreating} title="Nueva capacitación" size="lg">
        <TrainingForm
          portals={portals}
          submitLabel="Crear capacitación"
          onCancel={() => setCreating(false)}
          onSubmit={create}
        />
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar capacitación"
        size="lg"
      >
        {editing && (
          <TrainingForm
            portals={portals}
            submitLabel="Guardar cambios"
            defaults={{
              title: editing.title,
              description: editing.description ?? '',
              status: editing.status,
              publishedDate: editing.publishedDate ? editing.publishedDate.slice(0, 10) : '',
              categoryId: editing.categoryId,
              fileMediaId: editing.fileMediaId,
              imageMediaId: editing.imageMediaId,
              distributionType: editing.distributionType,
              portalIds: editing.portals.map((p) => p.id),
              file: editing.fileMediaId
                ? {
                    id: editing.fileMediaId,
                    url: editing.fileUrl,
                    name: editing.fileName ?? 'Archivo actual',
                    kind: editing.fileKind ?? undefined,
                  }
                : null,
              image: editing.imageMediaId
                ? { id: editing.imageMediaId, url: editing.imageUrl }
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
        title="Eliminar capacitación"
        message={`¿Eliminar "${deleting?.title}"? Dejará de estar disponible para los portales.`}
        confirmLabel="Eliminar"
        onConfirm={remove}
      />
    </div>
  );
}
