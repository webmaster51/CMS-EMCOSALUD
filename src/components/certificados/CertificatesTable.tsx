import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, FileText, Layers, Pencil, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { CertificateForm, type CompanyOpt } from './CertificateForm';
import { BulkUploadWizard } from './BulkUploadWizard';
import { PatternsPanel } from './PatternsPanel';
import type { CertificateDTO, FilenamePatternDTO } from '@/lib/dto/certificate';
import type { PagedDTO } from '@/lib/dto/portal';
import type { CertificateInput } from '@/lib/validations/certificate';

interface Props {
  initial: PagedDTO<CertificateDTO>;
  companies: CompanyOpt[];
  patterns: FilenamePatternDTO[];
  initialCompanyId?: number;
}

export default function CertificatesTable({
  initial,
  companies,
  patterns,
  initialCompanyId,
}: Props) {
  const [paged, setPaged] = useState(initial);
  const [q, setQ] = useState('');
  const [companyId, setCompanyId] = useState<number | ''>(initialCompanyId ?? '');
  const [year, setYear] = useState<number | ''>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [years, setYears] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CertificateDTO | null>(null);
  const [deleting, setDeleting] = useState<CertificateDTO | null>(null);
  const [bulk, setBulk] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);

  // Selección múltiple y eliminación masiva
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(
    async (page: number = 1) => {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (q) params.set('document', q);
      if (companyId !== '') params.set('companyId', String(companyId));
      if (year !== '') params.set('taxYear', String(year));
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await apiFetch<PagedDTO<CertificateDTO>>(`/api/admin/certificados?${params}`);
      if (res.ok) {
        setPaged(res.data);
        setSelectedIds([]);
      } else {
        toast.error(res.error);
      }
    },
    [q, companyId, year, fromDate, toDate],
  );

  // Carga dinámica de los años disponibles según la empresa seleccionada
  const loadYears = useCallback(async () => {
    const url = `/api/admin/certificados/anios${companyId !== '' ? `?companyId=${companyId}` : ''}`;
    const res = await apiFetch<number[]>(url);
    if (res.ok) {
      setYears(res.data);
    }
  }, [companyId]);

  useEffect(() => {
    void loadYears();
  }, [loadYears]);

  useEffect(() => {
    clearTimeout(debounce.current);
    // Cada vez que cambien los filtros (q, companyId, year, fromDate, toDate), 
    // reiniciamos la paginación a la página 1 para evitar resultados vacíos.
    debounce.current = setTimeout(() => void load(1), 300);
    return () => clearTimeout(debounce.current);
  }, [load]);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void load(1), 300);
    return () => clearTimeout(debounce.current);
  }, [load]);

  async function create(values: CertificateInput) {
    const res = await apiFetch<CertificateDTO>('/api/admin/certificados', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Certificado creado');
      setCreating(false);
      void load(1);
      void loadYears();
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function update(values: CertificateInput) {
    if (!editing) return;
    const res = await apiFetch<CertificateDTO>(`/api/admin/certificados/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Certificado actualizado');
      setEditing(null);
      void load(paged.meta.page);
      void loadYears();
      return;
    }
    return { error: res.error, fieldErrors: res.fieldErrors };
  }

  async function remove() {
    if (!deleting) return;
    const res = await apiFetch(`/api/admin/certificados/${deleting.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Certificado eliminado');
      setDeleting(null);
      void load(1);
      void loadYears();
    } else {
      toast.error(res.error);
    }
  }

  async function removeBulk() {
    if (selectedIds.length === 0) return;
    setIsDeletingBulk(true);

    try {
      const res = await apiFetch('/api/admin/certificados/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (res.ok) {
        toast.success(`${selectedIds.length} certificados eliminados`);
        setSelectedIds([]);
        setDeletingBulk(false);
        void load(1);
        void loadYears();
      } else {
        toast.error(res.error || 'Ocurrió un error al eliminar los certificados');
      }
    } catch {
      toast.error('Error de red al intentar eliminar los certificados');
    } finally {
      setIsDeletingBulk(false);
    }
  }

  const isAllSelected =
    paged.data.length > 0 && selectedIds.length === paged.data.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paged.data.map((item) => item.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(/-/g, '/'));
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros y Acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Documento o nombre…"
            className="w-48 rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>

        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value === '' ? '' : Number(e.target.value))}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
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
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">Todos los años</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {/* Rango de fechas */}
        <div className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-600">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-400">Desde:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-transparent text-sm outline-none"
          />
          <span className="text-xs text-slate-400">Hasta:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-transparent text-sm outline-none"
          />
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="ml-1 text-slate-400 hover:text-slate-600"
              title="Limpiar fechas"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Acciones principales */}
        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              onClick={() => setDeletingBulk(true)}
            >
              <Trash2 className="h-4 w-4" /> Eliminar ({selectedIds.length})
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={() => setShowPatterns(true)}>
            <Settings2 className="h-4 w-4" /> Patrones
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulk(true)}>
            <Layers className="h-4 w-4" /> Carga masiva
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </div>
      </div>

      {/* Tabla de Certificados */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="w-10 px-4 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    disabled={paged.data.length === 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                  />
                </th>
                <th className="px-3 py-2.5 font-medium">Documento</th>
                <th className="px-3 py-2.5 font-medium">Nombre / Archivo</th>
                <th className="px-3 py-2.5 font-medium">Empresa</th>
                <th className="px-3 py-2.5 font-medium">Año</th>
                <th className="px-3 py-2.5 font-medium">Fecha Subida</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 font-medium">PDF</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {paged.data.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-slate-400">
                    No hay certificados.
                  </td>
                </tr>
              )}
              {paged.data.map((c: CertificateDTO) => {
                const isSelected = selectedIds.includes(c.id);

                // Detección robusta de formato UUID en el nombre de archivo del backend
                const isUuid = c.pdfName
                  ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.pdf)?$/i.test(c.pdfName.trim())
                  : false;

                // Definimos el nombre principal de forma limpia (priorizando fullName de la persona)
                const displayName =
                  c.fullName && c.fullName.trim() !== ''
                    ? c.fullName
                    : !isUuid && c.pdfName
                    ? c.pdfName
                    : `Certificado ${c.documentNumber}`;

                // Solo mostramos texto secundario si hay un nombre de archivo real que no sea UUID
                const secondaryText =
                  !isUuid && c.pdfName && c.pdfName !== displayName ? c.pdfName : null;

                return (
                  <tr
                    key={c.id}
                    className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/60 ${
                      isSelected ? 'bg-brand-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium tabular-nums text-slate-700">
                      {c.documentNumber}
                    </td>

                    <td className="px-3 py-2.5 text-slate-700">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800" title={displayName}>
                          {displayName}
                        </span>
                        {secondaryText && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[220px]">
                            {secondaryText}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-slate-500">{c.companyName}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-500">{c.taxYear}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-500">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={c.status === 'active' ? 'success' : 'neutral'}>
                        {c.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {c.pdfUrl ? (
                        <a
                          href={c.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" /> Ver
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(c)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(c)}
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

      {/* Modal Nuevo Certificado */}
      <Dialog open={creating} onOpenChange={setCreating} title="Nuevo certificado">
        <CertificateForm
          companies={companies}
          submitLabel="Crear"
          onCancel={() => setCreating(false)}
          onSubmit={create}
        />
      </Dialog>

      {/* Modal Editar Certificado */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar certificado"
      >
        {editing && (
          <CertificateForm
            companies={companies}
            submitLabel="Guardar cambios"
            defaults={{
              companyId: editing.companyId,
              taxYear: editing.taxYear,
              documentNumber: editing.documentNumber,
              fullName: editing.fullName ?? '',
              pdfMediaId: editing.pdfMediaId,
              status: editing.status,
              issuedDate: editing.issuedDate ? editing.issuedDate.slice(0, 10) : '',
              pdf: {
                id: editing.pdfMediaId,
                url: editing.pdfUrl,
                name: editing.pdfName || editing.fullName || 'PDF actual',
                kind: 'document',
              },
            }}
            onCancel={() => setEditing(null)}
            onSubmit={update}
          />
        )}
      </Dialog>

      {/* Modal Carga Masiva */}
      <Dialog open={bulk} onOpenChange={setBulk} title="Carga masiva de certificados" size="lg">
        <BulkUploadWizard
          companies={companies}
          patterns={patterns}
          onDone={() => {
            setBulk(false);
            void load(1);
            void loadYears();
          }}
        />
      </Dialog>

      {/* Modal Patrones */}
      <Dialog
        open={showPatterns}
        onOpenChange={setShowPatterns}
        title="Patrones de nombre de archivo"
        size="lg"
      >
        <PatternsPanel initial={patterns} />
      </Dialog>

      {/* Diálogo Confirmación Individual */}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar certificado"
        message={`¿Eliminar el certificado ${deleting?.documentNumber} (${deleting?.taxYear})? También se borrará su PDF.`}
        confirmLabel="Eliminar"
        onConfirm={() => void remove()}
      />

      {/* Diálogo Confirmación Masiva */}
      <ConfirmDialog
        open={deletingBulk}
        onOpenChange={setDeletingBulk}
        title="Eliminar certificados seleccionados"
        message={`¿Estás seguro de que deseas eliminar los ${selectedIds.length} certificados seleccionados? Esta acción eliminará los registros y sus archivos PDF asociados.`}
        confirmLabel={isDeletingBulk ? 'Eliminando...' : 'Eliminar todos'}
        onConfirm={() => void removeBulk()}
      />
    </div>
  );
}