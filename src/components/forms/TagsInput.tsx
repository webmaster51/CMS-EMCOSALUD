import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

interface Props {
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
}

export function TagsInput({ label = 'Etiquetas', value, onChange }: Props) {
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void apiFetch<{ name: string }[]>('/api/admin/etiquetas').then((res) => {
      if (res.ok) setSuggestions(res.data.map((t) => t.name));
    });
  }, []);

  function add(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setDraft('');
  }

  function remove(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  const matches = draft
    ? suggestions
        .filter(
          (s) =>
            s.toLowerCase().includes(draft.toLowerCase()) &&
            !value.some((v) => v.toLowerCase() === s.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  return (
    <div className="text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1.5 focus-within:border-brand-500"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700"
          >
            {tag}
            <button type="button" onClick={() => remove(tag)}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) {
              remove(value[value.length - 1]!);
            }
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? '' : 'Añadir etiqueta y Enter'}
          className="min-w-[8rem] flex-1 border-0 py-0.5 text-sm outline-none"
        />
      </div>
      {matches.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {matches.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => add(m)}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
