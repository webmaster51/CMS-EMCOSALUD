import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { blogInputSchema, type BlogInput } from '@/lib/validations/blog';
import { slugify } from '@/lib/validations/common';
import { TextField, TextArea, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { PortalSelector, type PortalOption } from '@/components/forms/PortalSelector';
import { CategoryCombobox } from '@/components/forms/CategoryCombobox';
import { TagsInput } from '@/components/forms/TagsInput';
import { RichTextEditor } from '@/components/forms/RichTextEditor';
import { MediaPicker, type PickedMedia } from '@/components/multimedia/MediaPicker';

export interface BlogFormDefaults extends Partial<BlogInput> {
  featured?: PickedMedia | null;
  og?: PickedMedia | null;
  initialHtml?: string;
}

interface Props {
  portals: PortalOption[];
  defaults?: BlogFormDefaults;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (
    values: BlogInput,
  ) => Promise<{ fieldErrors?: Record<string, string>; error?: string } | void>;
}

export function BlogForm({ portals, defaults, submitLabel, onCancel, onSubmit }: Props) {
  const { featured: _f, og: _o, initialHtml, ...fieldDefaults } = defaults ?? {};
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BlogInput>({
    resolver: zodResolver(blogInputSchema),
    defaultValues: {
      title: '',
      slug: '',
      excerpt: '',
      contentHtml: '',
      contentJson: null,
      featuredMediaId: null,
      ogMediaId: null,
      categoryId: null,
      tagNames: [],
      publishDate: '',
      scheduleAt: '',
      status: 'draft',
      metaTitle: '',
      metaDescription: '',
      distributionType: 'specific',
      portalIds: [],
      ...fieldDefaults,
    },
  });

  const status = watch('status');
  const distributionType = watch('distributionType');
  const portalIds = watch('portalIds');
  const tagNames = watch('tagNames');

  async function submit(values: BlogInput) {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof BlogInput, { message: m });
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
        <TextField
          label="Título"
          required
          error={errors.title?.message}
          {...register('title', {
            onBlur: () => {
              if (!getValues('slug')) setValue('slug', slugify(getValues('title')));
            },
          })}
        />
        <TextField
          label="Slug"
          required
          hint="Para la URL del artículo"
          error={errors.slug?.message}
          {...register('slug')}
        />
      </div>

      <TextArea
        label="Resumen"
        hint="Aparece en los listados y como fallback de meta description"
        error={errors.excerpt?.message}
        {...register('excerpt')}
      />

      <RichTextEditor
        initialHtml={initialHtml}
        error={errors.contentHtml?.message}
        onChange={({ html, json }) => {
          setValue('contentHtml', html, { shouldValidate: true });
          setValue('contentJson', json);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <MediaPicker
          label="Imagen destacada"
          lockKind="image"
          accept="image/*"
          value={defaults?.featured ?? null}
          onChange={(m) => setValue('featuredMediaId', m?.id ?? null)}
        />
        <MediaPicker
          label="Imagen Open Graph"
          lockKind="image"
          accept="image/*"
          hint="Para compartir en redes (1200×630 recomendado)"
          value={defaults?.og ?? null}
          onChange={(m) => setValue('ogMediaId', m?.id ?? null)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CategoryCombobox
          module="blog"
          value={watch('categoryId') ?? null}
          onChange={(id) => setValue('categoryId', id)}
        />
        <TagsInput value={tagNames} onChange={(t) => setValue('tagNames', t)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Estado" {...register('status')}>
          <option value="draft">Borrador</option>
          <option value="scheduled">Programado</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </SelectField>
        {status === 'scheduled' ? (
          <TextField
            type="datetime-local"
            label="Publicar el"
            error={errors.scheduleAt?.message}
            {...register('scheduleAt')}
          />
        ) : (
          <TextField
            type="date"
            label="Fecha de publicación"
            error={errors.publishDate?.message}
            {...register('publishDate')}
          />
        )}
      </div>

      <details className="rounded-md border border-slate-200 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-slate-600">SEO</summary>
        <div className="mt-3 space-y-3">
          <TextField
            label="Meta title"
            error={errors.metaTitle?.message}
            {...register('metaTitle')}
          />
          <TextArea
            label="Meta description"
            error={errors.metaDescription?.message}
            {...register('metaDescription')}
          />
        </div>
      </details>

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
