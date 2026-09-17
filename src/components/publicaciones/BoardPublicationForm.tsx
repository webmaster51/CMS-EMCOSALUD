import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  boardPublicationInputSchema,
  type BoardPublicationInput,
} from '@/lib/validations/boardPublication';
import { TextField, TextArea, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { PortalSelector, type PortalOption } from '@/components/forms/PortalSelector';
import { MediaPicker, type PickedMedia } from '@/components/multimedia/MediaPicker';

export interface BoardPubFormDefaults extends Partial<BoardPublicationInput> {
  image?: PickedMedia | null;
}

interface Props {
  portals: PortalOption[];
  defaults?: BoardPubFormDefaults;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (
    values: BoardPublicationInput,
  ) => Promise<{ fieldErrors?: Record<string, string>; error?: string } | void>;
}

const today = () => new Date().toISOString().slice(0, 10);
const MESES = [
  { value: 'Enero', label: 'Enero' },
  { value: 'Febrero', label: 'Febrero' },
  { value: 'Marzo', label: 'Marzo' },
  { value: 'Abril', label: 'Abril' },
  { value: 'Mayo', label: 'Mayo' },
  { value: 'Junio', label: 'Junio' },
  { value: 'Julio', label: 'Julio' },
  { value: 'Agosto', label: 'Agosto' },
  { value: 'Septiembre', label: 'Septiembre' },
  { value: 'Octubre', label: 'Octubre' },
  { value: 'Noviembre', label: 'Noviembre' },
  { value: 'Diciembre', label: 'Diciembre' },
];

export function BoardPublicationForm({
  portals,
  defaults,
  submitLabel,
  onCancel,
  onSubmit,
}: Props) {
  const { image: _img, ...fieldDefaults } = defaults ?? {};
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BoardPublicationInput>({
    resolver: zodResolver(boardPublicationInputSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'draft',
      publishedDate: today(),
      imageMediaId: null,
      distributionType: 'specific',
      portalIds: [],
      ...fieldDefaults,
    },
  });

  const distributionType = watch('distributionType');
  const portalIds = watch('portalIds');

  async function submit(values: BoardPublicationInput) {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof BoardPublicationInput, { message: m });
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

      <SelectField label="Mes" required error={errors.title?.message} {...register('title')}>
        <option value="">Seleccione un mes</option>
          {MESES.map((mes) => (
        <option key={mes.value} value={mes.value}>
          {mes.label}
        </option>
        ))}
      </SelectField>
      <TextArea
        label="Descripción"
        error={errors.description?.message}
        {...register('description')}
      />

      <MediaPicker
        label="Imagen"
        lockKind="image"
        accept="image/jpeg,image/png,image/webp"
        hint="JPG, PNG o WEBP"
        error={errors.imageMediaId?.message}
        value={defaults?.image ?? null}
        onChange={(m) => setValue('imageMediaId', m?.id ?? null, { shouldValidate: true })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
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
