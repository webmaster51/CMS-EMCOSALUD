import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  pageMode: 'all_pages' | 'specific_pages';
  paths: string[];
  onChange: (value: { pageMode: 'all_pages' | 'specific_pages'; paths: string[] }) => void;
  error?: string;
}

const QUICK = ['/', '/noticias', '/servicios', '/contacto'];

/** Selector de páginas del popup (plan §22): todas o rutas específicas. */
export function PagesInput({ pageMode, paths, onChange, error }: Props) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    let p = raw.trim();
    if (!p) return;
    if (!p.startsWith('/')) p = `/${p}`;
    if (!paths.includes(p)) onChange({ pageMode, paths: [...paths, p] });
    setDraft('');
  };
  const remove = (p: string) =>
    onChange({ pageMode, paths: paths.filter((x) => x !== p) });

  return (
    <fieldset className="rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Páginas donde aparece
      </legend>

      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={pageMode === 'all_pages'}
            onChange={() => onChange({ pageMode: 'all_pages', paths: [] })}
          />
          Todas las páginas
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={pageMode === 'specific_pages'}
            onChange={() => onChange({ pageMode: 'specific_pages', paths })}
          />
          Páginas específicas
        </label>

        {pageMode === 'specific_pages' && (
          <div className="ml-6 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {paths.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700"
                >
                  {p}
                  <button type="button" onClick={() => remove(p)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add(draft);
                  }
                }}
                placeholder="/servicios/medicina-general"
                className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => add(draft)}
                className="rounded-md border border-slate-300 px-3 text-xs"
              >
                Añadir
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK.filter((q) => !paths.includes(q)).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => add(q)}
                  className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  + {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </fieldset>
  );
}
