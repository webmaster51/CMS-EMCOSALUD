import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { companyInputSchema, type CompanyInput } from '@/lib/validations/company';
import { TextField, TextArea, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ImagePicker } from '@/components/multimedia/ImagePicker';

interface Props {
  defaultValues?: Partial<CompanyInput>;
  logoPreviewUrl?: string | null;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (
    values: CompanyInput,
  ) => Promise<{ fieldErrors?: Record<string, string>; error?: string } | void>;
}

export function CompanyForm({
  defaultValues,
  logoPreviewUrl,
  submitLabel,
  onCancel,
  onSubmit,
}: Props) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CompanyInput>({
    resolver: zodResolver(companyInputSchema),
    defaultValues: {
      status: 'active',
      name: '',
      shortName: '',
      taxId: '',
      description: '',
      logoMediaId: null,
      ...defaultValues,
    },
  });

  async function submit(values: CompanyInput) {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof CompanyInput, { message });
      }
    }
    if (result?.error && !result.fieldErrors) {
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
        <TextField
          label="Nombre"
          required
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Nombre corto"
          required
          error={errors.shortName?.message}
          {...register('shortName')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="NIT / Identificación"
          required
          placeholder="900123456-7"
          error={errors.taxId?.message}
          {...register('taxId')}
        />
        <SelectField label="Estado" error={errors.status?.message} {...register('status')}>
          <option value="active">Activa</option>
          <option value="inactive">Inactiva</option>
        </SelectField>
      </div>

      <TextArea
        label="Descripción"
        error={errors.description?.message}
        {...register('description')}
      />

      <ImagePicker
        label="Logo"
        value={
          defaultValues?.logoMediaId && logoPreviewUrl
            ? { id: defaultValues.logoMediaId, url: logoPreviewUrl }
            : null
        }
        onChange={(m) => setValue('logoMediaId', m?.id ?? null, { shouldDirty: true })}
      />

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
