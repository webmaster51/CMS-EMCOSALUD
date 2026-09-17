import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileArchive, FileText, UploadCloud } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import type { BulkJobDTO, FilenamePatternDTO } from '@/lib/dto/certificate';
import type { CompanyOpt } from './CertificateForm';

interface Props {
  companies: CompanyOpt[];
  patterns: FilenamePatternDTO[];
  onDone: () => void;
}

type Mode = 'multi_pdf' | 'zip' | 'csv_zip';
type Step = 'config' | 'upload' | 'progress' | 'summary';

const FILE_BATCH = 20;

export function BulkUploadWizard({ companies, patterns, onDone }: Props) {
  const [step, setStep] = useState<Step>('config');
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? 0);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [patternId, setPatternId] = useState<number | ''>('');
  const [mode, setMode] = useState<Mode>('multi_pdf');

  const [jobId, setJobId] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(0);
  const [planillaRows, setPlanillaRows] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<BulkJobDTO | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  

  async function createJob() {
  const res = await apiFetch<{ id: string }>('/api/admin/bulk-jobs', {
    method: 'POST',
    body: JSON.stringify({
      companyId,
      taxYear,
      description: null,
      patternId: patternId === '' ? null : Number(patternId),
      kind: mode,
    }),
  });
  if (!res.ok) {
    toast.error(res.error);
    return;
  }
  setJobId(res.data.id);
  setStep('upload');
}

async function uploadPdfBatch(files: File[]) {
  if (!jobId) return;
  setUploading(true);
  
  for (let i = 0; i < files.length; i += FILE_BATCH) {
    const chunk = files.slice(i, i + FILE_BATCH);
    const form = new FormData();
    
    for (const f of chunk) {
      // ✅ Enviamos el archivo preservando su f.name original
      form.append('files', f);
    }

    const res = await fetch(`/api/admin/bulk-jobs/${jobId}/files`, {
      method: 'POST',
      body: form,
    });
    
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(b?.error ?? 'Error al subir un lote');
      break;
    }
    
    const b = (await res.json()) as { added: number };
    setUploaded((u) => u + b.added);
  }
  
  setUploading(false);
}

  async function uploadZip(file: File) {
    if (!jobId) return;
    setUploading(true);
    const form = new FormData();
    const originalName = file.name.split(/[/\\]/).pop() || file.name;
    const randomPrefix = Math.random().toString(36).substring(2, 10);
    const timestampPart = Date.now().toString(36);
    const formattedName = `${timestampPart}-${randomPrefix}-${originalName.toUpperCase()}`;
    
    form.append('zip', file, formattedName);
    const res = await fetch(`/api/admin/bulk-jobs/${jobId}/zip`, { method: 'POST', body: form });
    setUploading(false);
    const b = (await res.json().catch(() => null)) as { added?: number; error?: string } | null;
    if (!res.ok) {
      toast.error(b?.error ?? 'Error al subir el ZIP');
      return;
    }
    setUploaded((u) => u + (b?.added ?? 0));
    toast.success(`${b?.added ?? 0} PDF encontrados en el ZIP`);
  }

  async function uploadPlanilla(file: File) {
    if (!jobId) return;
    const form = new FormData();
    const originalName = file.name.split(/[/\\]/).pop() || file.name;
    form.append('planilla', file, originalName);
    const res = await fetch(`/api/admin/bulk-jobs/${jobId}/planilla`, {
      method: 'POST',
      body: form,
    });
    const b = (await res.json().catch(() => null)) as { rows?: number; error?: string } | null;
    if (!res.ok) {
      toast.error(b?.error ?? 'Error al leer la planilla');
      return;
    }
    setPlanillaRows(b?.rows ?? 0);
    toast.success(`${b?.rows ?? 0} filas leídas de la planilla`);
  }

  async function startProcessing() {
    if (!jobId) return;
    const res = await apiFetch(`/api/admin/bulk-jobs/${jobId}/start`, { method: 'POST' });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStep('progress');
  }

  const poll = useCallback(async () => {
    if (!jobId) return;
    const res = await apiFetch<BulkJobDTO>(`/api/admin/bulk-jobs/${jobId}`);
    if (res.ok) {
      setJob(res.data);
      if (['completed', 'completed_with_errors', 'failed'].includes(res.data.status)) {
        setStep('summary');
      }
    }
  }, [jobId]);

  useEffect(() => {
    if (step !== 'progress') return;
    void poll();
    pollRef.current = setInterval(() => void poll(), 1500);
    return () => clearInterval(pollRef.current);
  }, [step, poll]);

  const pct = job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {step === 'config' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Empresa</span>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Año gravable</span>
              <input
                type="number"
                value={taxYear}
                onChange={(e) => setTaxYear(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Patrón de nombre</span>
            <select
              value={patternId}
              onChange={(e) => setPatternId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Automático (probar todos los patrones)</option>
              {patterns
                .filter((p) => p.enabled)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>

          <div className="space-y-2 text-sm">
            <span className="block font-medium text-slate-700">Origen de los archivos</span>
            {(
              [
                ['multi_pdf', 'Varios PDF', 'Selecciona cientos o miles de archivos PDF'],
                ['zip', 'Un ZIP', 'Un archivo .zip con los PDF dentro'],
                ['csv_zip', 'Planilla + ZIP', 'CSV/Excel con documento y nombre + ZIP de PDF'],
              ] as const
            ).map(([m, title, desc]) => (
              <label
                key={m}
                className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 ${
                  mode === m ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  className="mt-0.5"
                  checked={mode === m}
                  onChange={() => setMode(m)}
                />
                <span>
                  <span className="font-medium text-slate-700">{title}</span>
                  <span className="block text-xs text-slate-500">{desc}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => void createJob()}>
              Continuar
            </Button>
          </div>
        </>
      )}

      {step === 'upload' && (
        <>
          {mode === 'csv_zip' && (
            <Dropzone
              icon={<FileText className="h-6 w-6 text-slate-400" />}
              label={
                planillaRows === null
                  ? 'Sube la planilla CSV o Excel'
                  : `Planilla cargada: ${planillaRows} filas`
              }
              accept=".csv,.xlsx,.xls"
              onFiles={(f) => void uploadPlanilla(f[0]!)}
            />
          )}

          {mode === 'multi_pdf' ? (
            <Dropzone
              icon={<UploadCloud className="h-6 w-6 text-slate-400" />}
              label={
                uploading
                  ? 'Subiendo…'
                  : uploaded > 0
                    ? `${uploaded} archivos cargados — añade más o continúa`
                    : 'Arrastra los PDF aquí (puedes seleccionar miles)'
              }
              accept="application/pdf"
              multiple
              onFiles={(f) => void uploadPdfBatch(f)}
            />
          ) : (
            <Dropzone
              icon={<FileArchive className="h-6 w-6 text-slate-400" />}
              label={uploading ? 'Subiendo ZIP…' : uploaded > 0 ? `${uploaded} PDF en el ZIP` : 'Sube el ZIP'}
              accept=".zip,application/zip"
              onFiles={(f) => void uploadZip(f[0]!)}
            />
          )}

          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setStep('config')}>
              Atrás
            </Button>
            <Button
              size="sm"
              disabled={uploaded === 0 || uploading}
              onClick={() => void startProcessing()}
            >
              Procesar {uploaded > 0 ? `(${uploaded})` : ''}
            </Button>
          </div>
        </>
      )}

      {step === 'progress' && (
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">Procesando…</p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Encontrados" value={job?.total ?? 0} />
            <Stat label="Procesados" value={job?.processed ?? 0} />
            <Stat label="Correctos" value={job?.succeeded ?? 0} tone="success" />
            <Stat label="Errores" value={job?.failed ?? 0} tone="danger" />
          </div>
        </div>
      )}

      {step === 'summary' && job && (
        <div className="space-y-4 py-2 text-center">
          <CheckCircle2
            className={`mx-auto h-10 w-10 ${
              job.failed > 0 ? 'text-warning' : 'text-success'
            }`}
          />
          <div>
            <p className="font-medium text-slate-800">
              {job.status === 'failed'
                ? 'La carga falló'
                : job.failed > 0
                  ? 'Carga completada con errores'
                  : 'Carga completada'}
            </p>
            <p className="text-sm text-slate-500">
              {job.succeeded} certificados cargados · {job.failed} errores · {job.total} en total
            </p>
          </div>
          <div className="flex justify-center gap-2">
            {job.errorReportUrl && (
              <a
                href={job.errorReportUrl}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" /> Reporte de errores
              </a>
            )}
            <Button size="sm" onClick={onDone}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'danger';
}) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums ${
          tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-slate-800'
        }`}
      >
        {value.toLocaleString('es-CO')}
      </p>
    </div>
  );
}

function Dropzone({
  icon,
  label,
  accept,
  multiple,
  onFiles,
}: {
  icon: React.ReactNode;
  label: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center ${
        drag ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-slate-450'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files) onFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
      {icon}
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
}