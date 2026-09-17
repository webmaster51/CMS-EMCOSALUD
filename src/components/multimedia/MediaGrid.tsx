import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Pagination } from '@/components/ui/Pagination';
import { MediaIcon, KIND_LABEL, humanSize } from './mediaIcon';
import type { MediaDTO } from '@/lib/dto/media';
import type { PagedDTO } from '@/lib/dto/portal';
import type { MediaKind } from '@/lib/storage/mime';

interface Props {
  /** Restringe a un tipo (p. ej. 'image' en el ImagePicker). */
  lockKind?: MediaKind;
  onPick: (media: MediaDTO) => void;
  selectedId?: string | null;
  /** Cambia este valor para forzar recarga tras subir/eliminar. */
  reloadKey?: number;
}

const KINDS: MediaKind[] = ['image', 'document', 'video', 'archive', 'other'];

export function MediaGrid({ lockKind, onPick, selectedId, reloadKey = 0 }: Props) {
  const [kind, setKind] = useState<MediaKind | 'all'>(lockKind ?? 'all');
  const [q, setQ] = useState('');
  const [paged, setPaged] = useState<PagedDTO<MediaDTO> | null>(null);
  const [loading, setLoading] = useState(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(
    async (page: number, search: string, k: MediaKind | 'all') => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '24' });
      if (search) params.set('q', search);
      if (k !== 'all') params.set('kind', k);
      const res = await apiFetch<PagedDTO<MediaDTO>>(`/api/admin/media?${params}`);
      setLoading(false);
      if (res.ok) setPaged(res.data);
      else toast.error(res.error);
    },
    [],
  );

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void load(1, q, kind), 250);
    return () => clearTimeout(debounce.current);
  }, [q, kind, reloadKey, load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        {!lockKind && (
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MediaKind | 'all')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="all">Todos los tipos</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && !paged ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : paged && paged.data.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          No hay archivos que coincidan.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {paged?.data.map((m) => {
            const preview = m.thumbnailUrl ?? (m.kind === 'image' ? m.url : null);
            const selected = selectedId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onPick(m)}
                title={m.internalName ?? m.originalName}
                className={`group overflow-hidden rounded-lg border text-left transition-colors ${
                  selected
                    ? 'border-brand-500 ring-2 ring-brand-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="grid aspect-square place-items-center bg-slate-50">
                  {preview ? (
                    <img
                      src={preview}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <MediaIcon kind={m.kind} className="h-8 w-8 text-slate-400" />
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-medium text-slate-700">
                    {m.internalName ?? m.originalName}
                  </p>
                  <p className="text-[0.7rem] text-slate-400">{humanSize(m.sizeBytes)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {paged && (
        <Pagination
          page={paged.meta.page}
          totalPages={paged.meta.totalPages}
          total={paged.meta.total}
          onPage={(page) => void load(page, q, kind)}
        />
      )}
    </div>
  );
}
