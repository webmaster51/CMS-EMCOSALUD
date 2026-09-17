import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { trainingInputSchema, type TrainingInput } from '@/lib/validations/training';
import { TextField, TextArea, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { PortalSelector, type PortalOption } from '@/components/forms/PortalSelector';
import { CategoryCombobox } from '@/components/forms/CategoryCombobox';
import { MediaPicker, type PickedMedia } from '@/components/multimedia/MediaPicker';

export interface TrainingFormDefaults extends Partial<TrainingInput> {
  file?: PickedMedia | null;
  image?: PickedMedia | null;
}

interface Props {
  portals: PortalOption[];
  defaults?: TrainingFormDefaults;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (
    values: TrainingInput,
  ) => Promise<{ fieldErrors?: Record<string, string>; error?: string } | void>;
}

const today = () => new Date().toISOString().slice(0, 10);

export function TrainingForm({ portals, defaults, submitLabel, onCancel, onSubmit }: Props) {
  const { file: _file, image: _image, ...fieldDefaults } = defaults ?? {};
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TrainingInput>({
    resolver: zodResolver(trainingInputSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'draft',
      publishedDate: today(),
      fileMediaId: null,
      imageMediaId: null,
      categoryId: null,
      distributionType: 'specific',
      portalIds: [],
      ...fieldDefaults,
    },
  });

  const distributionType = watch('distributionType');
  const portalIds = watch('portalIds');

  async function submit(values: TrainingInput) {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof TrainingInput, { message: m });
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

      <TextField label="Título" required error={errors.title?.message} {...register('title')} />
      <TextArea
        label="Descripción"
        error={errors.description?.message}
        {...register('description')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <MediaPicker
          label="Archivo"
          hint="PDF, Word, PowerPoint, Excel, ZIP, imagen o video"
          error={errors.fileMediaId?.message}
          value={defaults?.file ?? null}
          onChange={(m) => setValue('fileMediaId', m?.id ?? null, { shouldValidate: true })}
        />
        <MediaPicker
          label="Imagen (opcional)"
          lockKind="image"
          accept="image/*"
          value={defaults?.image ?? null}
          onChange={(m) => setValue('imageMediaId', m?.id ?? null)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CategoryCombobox
          module="training"
          value={watch('categoryId') ?? null}
          onChange={(id) => setValue('categoryId', id)}
        />
        <TextField
          type="date"
          label="Fecha"
          error={errors.publishedDate?.message}
          {...register('publishedDate')}
        />
        <SelectField label="Estado" {...register('status')}>
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </SelectField>
      </div>

      <PortalSelector
        portals={portals}
        value={{ distributionType, portalIds }}
        onChange={(v) => {
          setValue('distributionType', v.distributionType);
          setValue('portalIds', v.portalIds, { shouldValidate: true });
        }}
        error={errors.portalIds?.message}
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
