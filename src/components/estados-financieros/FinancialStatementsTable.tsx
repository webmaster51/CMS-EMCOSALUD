import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import {
  FinancialStatementForm,
  type CompanyOpt,
} from './FinancialStatementForm';
import type { PortalOption } from '@/components/forms/PortalSelector';
import type { FinancialStatementDTO } from '@/lib/dto/financialStatement';
import type { PagedDTO } from '@/lib/dto/portal';
import type { FinancialStatementInput } from '@/lib/validations/financialStatement';

interface Props {
  initial: PagedDTO<FinancialStatementDTO>;
  companies: CompanyOpt[];
  portals: PortalOption[];
}

const STATUS: Record<FinancialStatementDTO['status'], { label: string; tone: 'success' | 'neutral' | 'warning' }> = {
  draft: { label: 'Borrador', tone: 'neutral' },
  published: { label: 'Publicado', tone: 'success' },
  archived: { label: 'Archivado', tone: 'warning' },
};

function distribution(f: FinancialStatementDTO): string {
  if (f.distributionType === 'all') return 'Todos los portales';
  if (f.distributionType === 'specific') return f.portals[0]?.name ?? 'Portal';
  return `General · ${f.portals.map((x) => x.name).join(', ')}`;
}

export default function FinancialStatementsTable({ initial, companies, portals }: Props) {
  const [paged, setPaged] = useState(initial);
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [year, setYear] = useState<number | ''>('');
  const [years, setYears] = useState<number[]>([]);
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FinancialStatementDTO | null>(null);
  const [deleting, setDeleting] = useState<FinancialStatementDTO | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(
    async (page: number) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (companyId !== '') params.set('companyId', String(companyId));
      if (year !== '') params.set('fiscalYear', String(year));
      if (status) params.set('status', status);
      const res = await apiFetch<PagedDTO<FinancialStatementDTO>>(
        `/api/admin/estados-financieros?${params}`,
      );
      if (res.ok) setPaged(res.data);
      else toast.error(res.error);
    },
    [companyId, year, status],
  );

  useEffect(() => {
    const url = `/api/admin/estados-financieros/anios${companyId !== '' ? `?companyId=${companyId}` : ''}`;
    void apiFetch<number[]>(url).then((r) => r.ok && setYears(r.data));
  }, [companyId]);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void load(1), 300);
    return () => clearTimeout(debounce.current);
  }, [load]);

  function editorDefaults(f: FinancialStatementDTO) {
    return {
      companyId: f.companyId,
      fiscalYear: f.fiscalYear,
      title: f.title ?? '',
      summary: f.summary ?? '',
      publishedDate: f.publishedDate ? f.publishedDate.slice(0, 10) : '',
      status: f.status,
      distributionType: f.distributionType,
      portalIds: f.portals.map((x) => x.id),
      files: f.files.map((file) => ({
        label: file.label,
        media: { id: file.mediaId, url: file.url, name: file.label, kind: 'document' as const },
      })),
    };
  }

  async function create(values: FinancialStatementInput) {
    const res = await apiFetch<FinancialStatementDTO>('/api/admin/estados-financieros', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Estados financieros publicados');
      setCreating(false);
      void load(1);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function update(values: FinancialStatementInput) {
    if (!editing) return;
    const res = await apiFetch<FinancialStatementDTO>(
      `/api/admin/estados-financieros/${editing.id}`,
      { method: 'PATCH', body: JSON.stringify(values) },
    );
    if (res.ok) {
      toast.success('Estados financieros actualizados');
      setEditing(null);
      void load(paged.meta.page);
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function remove() {
    if (!deleting) return;
    const res = await apiFetch(`/api/admin/estados-financieros/${deleting.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast.success('Estados financieros eliminados');
      void load(1);
    } else toast.error(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value === '' ? '' : Number(e.target.value))}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todas las empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos los años</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
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
        <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-medium">Empresa</th>
                <th className="px-3 py-2.5 font-medium">Año</th>
                <th className="px-3 py-2.5 font-medium">Título</th>
                <th className="px-3 py-2.5 font-medium">Docs.</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {paged.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No hay estados financieros.
                  </td>
                </tr>
              )}
              {paged.data.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-2.5 font-medium text-slate-700">{f.companyName}</td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-500">{f.fiscalYear}</td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {f.title ?? `Estados Financieros ${f.fiscalYear}`}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> {f.files.length}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={STATUS[f.status].tone}>{STATUS[f.status].label}</Badge>
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(f)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleting(f)}
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
          onPage={(page) => void load(page)}
        />
      </div>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="Publicar estados financieros"
        size="lg"
      >
        <FinancialStatementForm
          companies={companies}
          portals={portals}
          submitLabel="Publicar"
          onCancel={() => setCreating(false)}
          onSubmit={create}
        />
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar estados financieros"
        size="lg"
      >
        {editing && (
          <FinancialStatementForm
            companies={companies}
            portals={portals}
            submitLabel="Guardar cambios"
            defaults={editorDefaults(editing)}
            onCancel={() => setEditing(null)}
            onSubmit={update}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar estados financieros"
        message={`¿Eliminar los estados financieros de ${deleting?.companyName} (${deleting?.fiscalYear})? También se borran sus documentos.`}
        confirmLabel="Eliminar"
        onConfirm={remove}
      />
    </div>
  );
}
