import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  financialStatementInputSchema,
  type FinancialStatementInput,
} from '@/lib/validations/financialStatement';
import { TextField, TextArea, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { PortalSelector, type PortalOption } from '@/components/forms/PortalSelector';
import { MediaPicker, type PickedMedia } from '@/components/multimedia/MediaPicker';

export interface CompanyOpt {
  id: number;
  name: string;
}

interface FileRow {
  label: string;
  media: PickedMedia | null;
}

export interface FinancialStatementFormDefaults
  extends Partial<Omit<FinancialStatementInput, 'files'>> {
  files?: FileRow[];
}

interface Props {
  companies: CompanyOpt[];
  portals: PortalOption[];
  defaults?: FinancialStatementFormDefaults;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (
    values: FinancialStatementInput,
  ) => Promise<{ fieldErrors?: Record<string, string>; error?: string } | void>;
}

const H = ({ children }: { children: React.ReactNode }) => (
  <p className="border-b border-slate-100 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
    {children}
  </p>
);

const SUGGESTED = [
  'Estado de situación financiera',
  'Estado de resultados',
  'Estado de flujos de efectivo',
  'Estado de cambios en el patrimonio',
  'Notas a los estados financieros',
  'Dictamen del revisor fiscal',
];

export function FinancialStatementForm({
  companies,
  portals,
  defaults,
  submitLabel,
  onCancel,
  onSubmit,
}: Props) {
  const { files: fileDefaults, ...fieldDefaults } = defaults ?? {};
  const [files, setFiles] = useState<FileRow[]>(fileDefaults ?? []);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FinancialStatementInput>({
    resolver: zodResolver(financialStatementInputSchema),
    defaultValues: {
      companyId: companies[0]?.id ?? 0,
      fiscalYear: new Date().getFullYear() - 1,
      title: '',
      summary: '',
      publishedDate: '',
      status: 'draft',
      files: [],
      distributionType: 'specific',
      portalIds: [],
      ...fieldDefaults,
    },
  });

  const distributionType = watch('distributionType');
  const portalIds = watch('portalIds');
  const fiscalYear = watch('fiscalYear');

  function syncFiles(next: FileRow[]) {
    setFiles(next);
    setValue(
      'files',
      next
        .filter((r) => r.media)
        .map((r) => ({ label: r.label, mediaId: r.media!.id })),
      { shouldValidate: true },
    );
  }

  const setRow = (i: number, patch: Partial<FileRow>) =>
    syncFiles(files.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => syncFiles([...files, { label: '', media: null }]);
  const removeRow = (i: number) => syncFiles(files.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j]!, next[i]!];
    syncFiles(next);
  };

  async function submit(values: FinancialStatementInput) {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof FinancialStatementInput, { message: m });
      }
    } else if (result?.error) {
      setError('root', { message: result.error });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      {errors.root && (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {errors.root.message}
        </p>
      )}

      <div className="space-y-3">
        <H>Publicación</H>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Empresa"
            required
            error={errors.companyId?.message}
            {...register('companyId', { valueAsNumber: true })}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <TextField
            type="number"
            label="Año"
            required
            hint="Se publica una vez por año"
            error={errors.fiscalYear?.message}
            {...register('fiscalYear', { valueAsNumber: true })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Título"
            placeholder={`Estados Financieros ${fiscalYear || ''}`.trim()}
            error={errors.title?.message}
            {...register('title')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              type="date"
              label="Fecha de publicación"
              error={errors.publishedDate?.message}
              {...register('publishedDate')}
            />
            <SelectField label="Estado" {...register('status')}>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </SelectField>
          </div>
        </div>
        <TextArea
          label="Resumen"
          error={errors.summary?.message}
          {...register('summary')}
        />
      </div>

      <div className="space-y-3">
        <H>Documentos</H>
        {errors.files && (
          <p className="text-xs text-danger">{errors.files.message}</p>
        )}
        <div className="space-y-3">
          {files.map((row, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={row.label}
                  onChange={(e) => setRow(i, { label: e.target.value })}
                  list="fs-labels"
                  placeholder="Nombre del documento"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === files.length - 1}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="rounded p-1 text-slate-400 hover:bg-danger-bg hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <MediaPicker
                label="Archivo"
                lockKind="document"
                accept="application/pdf"
                value={row.media}
                onChange={(m) => setRow(i, { media: m })}
              />
            </div>
          ))}
        </div>
        <datalist id="fs-labels">
          {SUGGESTED.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4" /> Añadir documento
        </Button>
      </div>

      <div className="space-y-3">
        <H>Dónde se muestra</H>
        <PortalSelector
          portals={portals}
          value={{ distributionType, portalIds }}
          onChange={(v) => {
            setValue('distributionType', v.distributionType);
            setValue('portalIds', v.portalIds, { shouldValidate: true });
          }}
          error={errors.portalIds?.message}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
