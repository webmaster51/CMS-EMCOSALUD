import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import type { CategoryModule } from '@/lib/validations/category';

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Props {
  module: CategoryModule;
  value: number | null;
  onChange: (id: number | null) => void;
  label?: string;
}

export function CategoryCombobox({ module, value, onChange, label = 'Categoría' }: Props) {
  const [items, setItems] = useState<Category[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch<Category[]>(`/api/admin/categorias?module=${module}`).then((res) => {
      if (res.ok) setItems(res.data);
    });
  }, [module]);

  async function create() {
    if (name.trim().length < 2) return;
    setBusy(true);
    const res = await apiFetch<Category>('/api/admin/categorias', {
      method: 'POST',
      body: JSON.stringify({ module, name: name.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      setItems((prev) =>
        prev.some((c) => c.id === res.data.id) ? prev : [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      onChange(res.data.id);
      setAdding(false);
      setName('');
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {adding ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void create())}
            placeholder="Nombre de la categoría"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
          />
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className="rounded-md bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Crear
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-brand-500"
          >
            <option value="">Sin categoría</option>
            {items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAdding(true)}
            title="Nueva categoría"
            className="rounded-md border border-slate-300 px-2.5 text-slate-500 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
