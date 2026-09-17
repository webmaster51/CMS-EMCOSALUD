import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GalleryHorizontalEnd, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { BannerForm } from './BannerForm';
import type { PortalOption } from '@/components/forms/PortalSelector';
import type { BannerDTO } from '@/lib/dto/banner';
import type { PagedDTO } from '@/lib/dto/portal';
import type { BannerInput } from '@/lib/validations/banner';

interface Props {
  initial: PagedDTO<BannerDTO>;
  portals: PortalOption[];
}

function distribution(b: BannerDTO): { label: string; tone: 'brand' | 'accent' | 'neutral' } {
  if (b.distributionType === 'all') return { label: 'Todos los portales', tone: 'accent' };
  if (b.distributionType === 'specific')
    return { label: b.portals[0]?.name ?? 'Portal', tone: 'neutral' };
  return { label: `General · ${b.portals.map((x) => x.name).join(', ')}`, tone: 'brand' };
}

export default function BannersTable({ initial, portals }: Props) {
  const [paged, setPaged] = useState(initial);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [portalId, setPortalId] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BannerDTO | null>(null);
  const [deleting, setDeleting] = useState<BannerDTO | null>(null);
  const [reordering, setReordering] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(
    async (page: number) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      if (portalId) params.set('portalId', portalId);
      const res = await apiFetch<PagedDTO<BannerDTO>>(`/api/admin/banners?${params}`);
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

  async function create(values: BannerInput) {
    const res = await apiFetch<BannerDTO>('/api/admin/banners', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Banner creado');
      setCreating(false);
      void load(1);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function update(values: BannerInput) {
    if (!editing) return;
    const res = await apiFetch<BannerDTO>(`/api/admin/banners/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Banner actualizado');
      setEditing(null);
      void load(paged.meta.page);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function remove() {
    if (!deleting) return;
    const res = await apiFetch(`/api/admin/banners/${deleting.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Banner eliminado');
      void load(1);
    } else toast.error(res.error);
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    const list = paged.data;
    if (j < 0 || j >= list.length || reordering) return;
    const next = [...list];
    [next[index], next[j]] = [next[j]!, next[index]!];
    setPaged({ ...paged, data: next });
    setReordering(true);
    const res = await apiFetch('/api/admin/banners/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ ids: next.map((b) => b.id) }),
    });
    setReordering(false);
    if (res.ok) void load(paged.meta.page);
    else {
      toast.error(res.error);
      setPaged({ ...paged, data: list });
    }
  }

  const activeInOrder = [...paged.data]
    .filter((b) => b.status === 'active')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Carrusel activo{portalId ? '' : ' (todos los portales)'}
        </p>
        {activeInOrder.length === 0 ? (
          <p className="text-sm text-slate-400">
            Sin banners activos{portalId ? ' en este portal' : ''}.
          </p>
        ) : (
          <ol className="flex flex-wrap gap-3">
            {activeInOrder.map((b, i) => (
              <li key={b.id} className="w-40">
                <div className="relative aspect-video overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-slate-300">
                      <GalleryHorizontalEnd className="h-5 w-5" />
                    </span>
                  )}
                  <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-600">{b.internalName}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar banner…"
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
          <Plus className="h-4 w-4" /> Nuevo banner
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2.5 text-center font-medium">Orden</th>
                <th className="px-3 py-2.5 font-medium">Banner</th>
                <th className="px-3 py-2.5 font-medium">Distribución</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {paged.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    No hay banners.
                  </td>
                </tr>
              )}
              {paged.data.map((b, i) => {
                const dist = distribution(b);
                return (
                  <tr
                    key={b.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => void move(i, -1)}
                          disabled={i === 0 || reordering}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                          title="Subir"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <span className="tabular-nums text-slate-400">{b.sortOrder}</span>
                        <button
                          onClick={() => void move(i, 1)}
                          disabled={i === paged.data.length - 1 || reordering}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                          title="Bajar"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {b.imageUrl ? (
                          <img
                            src={b.imageUrl}
                            alt=""
                            className="h-9 w-16 rounded object-cover"
                          />
                        ) : (
                          <span className="grid h-9 w-16 place-items-center rounded bg-slate-100 text-slate-400">
                            <GalleryHorizontalEnd className="h-4 w-4" />
                          </span>
                        )}
                        <div>
                          <div className="font-medium text-slate-700">{b.internalName}</div>
                          {b.title && <div className="text-xs text-slate-400">{b.title}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={dist.tone}>{dist.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(b)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
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

      <Dialog open={creating} onOpenChange={setCreating} title="Nuevo banner" size="lg">
        <BannerForm
          portals={portals}
          submitLabel="Crear banner"
          onCancel={() => setCreating(false)}
          onSubmit={create}
        />
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar banner"
        size="lg"
      >
        {editing && (
          <BannerForm
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
              sortOrder: editing.sortOrder,
              startsAt: editing.startsAt ? editing.startsAt.slice(0, 16) : '',
              endsAt: editing.endsAt ? editing.endsAt.slice(0, 16) : '',
              status: editing.status,
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
        title="Eliminar banner"
        message={`¿Eliminar "${deleting?.internalName}"? Dejará de mostrarse en los sitios.`}
        confirmLabel="Eliminar"
        onConfirm={remove}
      />
    </div>
  );
}
