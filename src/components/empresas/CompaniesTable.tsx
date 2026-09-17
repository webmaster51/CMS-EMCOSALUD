import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { CompanyForm } from './CompanyForm';
import type { CompanyDTO } from '@/lib/dto/company';
import type { PagedDTO } from '@/lib/dto/portal';
import type { CompanyInput } from '@/lib/validations/company';

interface Props {
  initial: PagedDTO<CompanyDTO>;
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso));

export default function CompaniesTable({ initial }: Props) {
  const [paged, setPaged] = useState(initial);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CompanyDTO | null>(null);
  const [deleting, setDeleting] = useState<CompanyDTO | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async (page: number, search: string) => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('q', search);
    const res = await apiFetch<PagedDTO<CompanyDTO>>(`/api/admin/empresas?${params}`);
    if (res.ok) setPaged(res.data);
    else toast.error(res.error);
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void load(1, q), 300);
    return () => clearTimeout(debounce.current);
  }, [q, load]);

  async function createCompany(values: CompanyInput) {
    const res = await apiFetch<CompanyDTO>('/api/admin/empresas', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Empresa creada');
      setCreating(false);
      void load(1, q);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function updateCompany(values: CompanyInput) {
    if (!editing) return;
    const res = await apiFetch<CompanyDTO>(`/api/admin/empresas/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Empresa actualizada');
      setEditing(null);
      void load(paged.meta.page, q);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function removeCompany() {
    if (!deleting) return;
    const res = await apiFetch(`/api/admin/empresas/${deleting.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Empresa eliminada');
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
            placeholder="Buscar empresa…"
            className="w-64 rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nueva empresa
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-medium">Empresa</th>
                <th className="px-3 py-2.5 font-medium">NIT</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 text-right font-medium">Certificados</th>
                <th className="px-3 py-2.5 font-medium">Creada</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {paged.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    No hay empresas que coincidan.
                  </td>
                </tr>
              )}
              {paged.data.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {c.logoUrl ? (
                        <img
                          src={c.logoUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-slate-100 text-xs font-semibold text-slate-400">
                          {c.shortName.charAt(0)}
                        </span>
                      )}
                      <div>
                        <div className="font-medium text-slate-700">{c.name}</div>
                        <div className="text-xs text-slate-400">{c.shortName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{c.taxId}</code>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={c.status === 'active' ? 'success' : 'neutral'}>
                      {c.status === 'active' ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {c.certificateCount > 0 ? (
                      <a
                        href={`/admin/certificados?empresa=${c.id}`}
                        className="tabular-nums text-brand-600 hover:underline"
                      >
                        {c.certificateCount.toLocaleString('es-CO')}
                      </a>
                    ) : (
                      <span className="tabular-nums text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{fmtDate(c.createdAt)}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        title="Editar"
                        onClick={() => setEditing(c)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => setDeleting(c)}
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

      <Dialog open={creating} onOpenChange={setCreating} title="Nueva empresa">
        <CompanyForm
          submitLabel="Crear empresa"
          onCancel={() => setCreating(false)}
          onSubmit={createCompany}
        />
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={`Editar ${editing?.name ?? ''}`}
      >
        {editing && (
          <CompanyForm
            submitLabel="Guardar cambios"
            logoPreviewUrl={editing.logoUrl}
            defaultValues={{
              name: editing.name,
              shortName: editing.shortName,
              taxId: editing.taxId,
              description: editing.description ?? '',
              status: editing.status,
              logoMediaId: editing.logoMediaId,
            }}
            onCancel={() => setEditing(null)}
            onSubmit={updateCompany}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar empresa"
        message={`¿Eliminar "${deleting?.name}"? Si tiene certificados asociados, desactívala en su lugar.`}
        confirmLabel="Eliminar"
        onConfirm={removeCompany}
      />
    </div>
  );
}
