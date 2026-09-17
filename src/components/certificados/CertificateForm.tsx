import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { certificateInputSchema, type CertificateInput } from '@/lib/validations/certificate';
import { TextField, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { MediaPicker, type PickedMedia } from '@/components/multimedia/MediaPicker';

export interface CompanyOpt {
  id: number;
  name: string;
}

export interface CertFormDefaults extends Partial<CertificateInput> {
  pdf?: PickedMedia | null;
}

interface Props {
  companies: CompanyOpt[];
  defaults?: CertFormDefaults;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (
    values: CertificateInput,
  ) => Promise<{ fieldErrors?: Record<string, string>; error?: string } | void>;
}

export function CertificateForm({
  companies,
  defaults,
  submitLabel,
  onCancel,
  onSubmit,
}: Props) {
  const { pdf: initialPdf, ...fieldDefaults } = defaults ?? {};

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CertificateInput>({
    resolver: zodResolver(certificateInputSchema),
    defaultValues: {
      companyId: companies[0]?.id ?? 0,
      taxYear: new Date().getFullYear(),
      documentNumber: '',
      fullName: '',
      pdfMediaId: initialPdf?.id ?? '',
      status: 'active',
      issuedDate: '',
      ...fieldDefaults,
    },
  });

  function handleMediaChange(media: PickedMedia | null) {
    const mediaId = media?.id ?? '';
    setValue('pdfMediaId', mediaId, { shouldValidate: true, shouldDirty: true });

    if (media) {
      const mediaRecord = media as unknown as Record<string, unknown>;
      const filename =
        (typeof mediaRecord.filename === 'string' && mediaRecord.filename) ||
        (typeof mediaRecord.originalFilename === 'string' && mediaRecord.originalFilename) ||
        (typeof mediaRecord.originalName === 'string' && mediaRecord.originalName) ||
        (typeof mediaRecord.name === 'string' && mediaRecord.name) ||
        (typeof mediaRecord.title === 'string' && mediaRecord.title) ||
        '';

      if (filename && !getValues('fullName')) {
        setValue('fullName', filename, { shouldValidate: true, shouldDirty: true });
      }
    }
  }

  async function submit(values: CertificateInput) {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof CertificateInput, { message: m });
      }
    } else if (result?.error) {
      setError('root', { message: result.error });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {errors.root && (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {errors.root.message}
        </p>
      )}

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
          label="Año gravable"
          required
          error={errors.taxYear?.message}
          {...register('taxYear', { valueAsNumber: true })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Documento"
          required
          error={errors.documentNumber?.message}
          {...register('documentNumber')}
        />
        <TextField label="Nombre" error={errors.fullName?.message} {...register('fullName')} />
      </div>

      <MediaPicker
        label="Archivo PDF"
        lockKind="document"
        accept="application/pdf"
        error={errors.pdfMediaId?.message}
        value={initialPdf ?? null}
        onChange={handleMediaChange}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          type="date"
          label="Fecha"
          error={errors.issuedDate?.message}
          {...register('issuedDate')}
        />
        <SelectField label="Estado" {...register('status')}>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </SelectField>
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