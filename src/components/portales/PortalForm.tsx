import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { portalInputSchema, type PortalInput } from '@/lib/validations/portal';
import { slugify } from '@/lib/validations/common';
import { TextField, TextArea, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ImagePicker } from '@/components/multimedia/ImagePicker';

interface Props {
  defaultValues?: Partial<PortalInput>;
  logoPreviewUrl?: string | null;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (
    values: PortalInput,
  ) => Promise<{ fieldErrors?: Record<string, string>; error?: string } | void>;
}

export function PortalForm({
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
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PortalInput>({
    resolver: zodResolver(portalInputSchema),
    defaultValues: {
      status: 'active',
      name: '',
      shortName: '',
      slug: '',
      url: '',
      description: '',
      deployHookUrl: '',
      logoMediaId: null,
      ...defaultValues,
    },
  });

  async function submit(values: PortalInput) {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof PortalInput, { message });
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
          {...register('name', {
            onBlur: () => {
              if (!getValues('slug')) setValue('slug', slugify(getValues('name')));
            },
          })}
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
          label="Slug"
          required
          hint="Identificador para la API (?portal=slug)"
          error={errors.slug?.message}
          {...register('slug')}
        />
        <SelectField label="Estado" {...register('status')} error={errors.status?.message}>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </SelectField>
      </div>

      <TextField
        label="URL del sitio"
        required
        placeholder="https://emcosalud.com"
        error={errors.url?.message}
        {...register('url')}
      />

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
        onChange={(m) =>
          setValue('logoMediaId', m?.id ?? null, { shouldDirty: true })
        }
      />

      <TextField
        label="Deploy hook (opcional)"
        hint="URL que se llamará al publicar contenido para reconstruir el sitio"
        placeholder="https://api.netlify.com/build_hooks/..."
        error={errors.deployHookUrl?.message}
        {...register('deployHookUrl')}
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
