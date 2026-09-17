import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bannerInputSchema, type BannerInput } from '@/lib/validations/banner';
import { TextField, TextArea, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { PortalSelector, type PortalOption } from '@/components/forms/PortalSelector';
import { MediaPicker, type PickedMedia } from '@/components/multimedia/MediaPicker';

export interface BannerFormDefaults extends Partial<BannerInput> {
  image?: PickedMedia | null;
  mobileImage?: PickedMedia | null;
}

interface Props {
  portals: PortalOption[];
  defaults?: BannerFormDefaults;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (
    values: BannerInput,
  ) => Promise<{ fieldErrors?: Record<string, string>; error?: string } | void>;
}

const H = ({ children }: { children: React.ReactNode }) => (
  <p className="border-b border-slate-100 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
    {children}
  </p>
);

export function BannerForm({ portals, defaults, submitLabel, onCancel, onSubmit }: Props) {
  const { image: _i, mobileImage: _m, ...fieldDefaults } = defaults ?? {};
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BannerInput>({
    resolver: zodResolver(bannerInputSchema),
    defaultValues: {
      internalName: '',
      title: '',
      subtitle: '',
      description: '',
      imageMediaId: null,
      mobileImageMediaId: null,
      buttonText: '',
      url: '',
      linkType: 'none',
      sortOrder: 0,
      startsAt: '',
      endsAt: '',
      status: 'draft',
      distributionType: 'specific',
      portalIds: [],
      ...fieldDefaults,
    },
  });

  const distributionType = watch('distributionType');
  const portalIds = watch('portalIds');
  const linkType = watch('linkType');

  async function submit(values: BannerInput) {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof BannerInput, { message: m });
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
        <H>General</H>
        <TextField
          label="Nombre interno"
          required
          hint="Solo se ve en el panel"
          error={errors.internalName?.message}
          {...register('internalName')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Estado" {...register('status')}>
            <option value="draft">Borrador</option>
            <option value="scheduled">Programado</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="finished">Finalizado</option>
          </SelectField>
          <TextField
            type="number"
            label="Orden"
            hint="Menor = aparece antes en el carrusel"
            error={errors.sortOrder?.message}
            {...register('sortOrder', { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <H>Contenido</H>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Título" error={errors.title?.message} {...register('title')} />
          <TextField
            label="Subtítulo"
            error={errors.subtitle?.message}
            {...register('subtitle')}
          />
        </div>
        <TextArea
          label="Descripción"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <MediaPicker
            label="Imagen"
            lockKind="image"
            accept="image/*"
            value={defaults?.image ?? null}
            onChange={(m) => setValue('imageMediaId', m?.id ?? null)}
          />
          <MediaPicker
            label="Imagen móvil"
            lockKind="image"
            accept="image/*"
            value={defaults?.mobileImage ?? null}
            onChange={(m) => setValue('mobileImageMediaId', m?.id ?? null)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Texto del botón" {...register('buttonText')} />
          <SelectField label="Tipo de enlace" {...register('linkType')}>
            <option value="none">Sin enlace</option>
            <option value="internal">Interno</option>
            <option value="external">Externo</option>
          </SelectField>
          {linkType !== 'none' && (
            <TextField
              label="URL"
              placeholder={linkType === 'internal' ? '/servicios' : 'https://…'}
              error={errors.url?.message}
              {...register('url')}
            />
          )}
        </div>
      </div>

      <div className="space-y-3">
        <H>En qué portales</H>
        <p className="text-xs text-slate-400">
          El banner se muestra fijo en la página de inicio del portal.
        </p>
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

      <div className="space-y-3">
        <H>Programación</H>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            type="datetime-local"
            label="Fecha inicial"
            error={errors.startsAt?.message}
            {...register('startsAt')}
          />
          <TextField
            type="datetime-local"
            label="Fecha final"
            error={errors.endsAt?.message}
            {...register('endsAt')}
          />
        </div>
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
