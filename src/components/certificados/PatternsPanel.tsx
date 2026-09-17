import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import {
  filenamePatternInputSchema,
  type FilenamePatternInput,
} from '@/lib/validations/certificate';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import type { FilenamePatternDTO } from '@/lib/dto/certificate';

interface Props {
  initial: FilenamePatternDTO[];
}

export function PatternsPanel({ initial }: Props) {
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<FilenamePatternInput>({
    resolver: zodResolver(filenamePatternInputSchema),
    defaultValues: { name: '', regex: '', documentGroup: 'doc', yearGroup: '', enabled: true },
  });

  async function toggle(p: FilenamePatternDTO) {
    setLoadingId(p.id);
    const res = await apiFetch<{ enabled: boolean }>(
      `/api/admin/certificados/patrones/${p.id}`,
      { method: 'PATCH', body: JSON.stringify({ enabled: !p.enabled }) },
    );
    setLoadingId(null);

    if (res.ok) {
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, enabled: !x.enabled } : x)));
    } else {
      toast.error(res.error);
    }
  }

  async function remove(p: FilenamePatternDTO) {
    if (!confirm(`¿Eliminar el patrón "${p.name}"?`)) return;

    setLoadingId(p.id);
    const res = await apiFetch(`/api/admin/certificados/patrones/${p.id}`, { method: 'DELETE' });
    setLoadingId(null);

    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      toast.success('Patrón eliminado');
    } else {
      toast.error(res.error);
    }
  }

  async function create(values: FilenamePatternInput) {
    const res = await apiFetch<FilenamePatternDTO>('/api/admin/certificados/patrones', {
      method: 'POST',
      body: JSON.stringify(values),
    });

    if (res.ok) {
      setItems((prev) => [...prev, res.data]);
      setAdding(false);
      reset();
      toast.success('Patrón creado');
    } else {
      toast.error(res.error);
    }
  }

  function handleCancel() {
    setAdding(false);
    reset();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Expresiones regulares con grupos nombrados <code>doc</code> y opcional <code>year</code>.
        Se prueban en orden durante la carga masiva.
      </p>

      <div className="card divide-y divide-slate-100">
        {items.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={p.enabled}
              disabled={loadingId === p.id}
              onChange={() => void toggle(p)}
              title={p.enabled ? 'Activo' : 'Inactivo'}
              className="cursor-pointer disabled:opacity-50"
            />
            <div className="flex-1">
              <div className="font-medium text-slate-700">
                {p.name} {p.isDefault && <span className="text-xs text-slate-400">(por defecto)</span>}
              </div>
              <code className="text-xs text-slate-500">{p.regex}</code>
            </div>
            {!p.isDefault && (
              <button
                type="button"
                disabled={loadingId === p.id}
                onClick={() => void remove(p)}
                className="rounded p-1 text-slate-400 hover:bg-danger-bg hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <form onSubmit={handleSubmit(create)} className="card space-y-3 p-4">
          <TextField label="Nombre" error={formState.errors.name?.message} {...register('name')} />
          <TextField
            label="Expresión regular"
            hint="Ej: ^(?<doc>\d{6,15})[-_].*"
            error={formState.errors.regex?.message}
            {...register('regex')}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Grupo del documento" {...register('documentGroup')} />
            <TextField label="Grupo del año (opcional)" {...register('yearGroup')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={formState.isSubmitting}>
              Crear patrón
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            reset();
            setAdding(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nuevo patrón
        </Button>
      )}
    </div>
  );
}