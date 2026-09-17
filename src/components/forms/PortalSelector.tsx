import type { DistributionValue } from '@/lib/validations/distribution';

export interface PortalOption {
  id: number;
  name: string;
}

interface Props {
  portals: PortalOption[];
  value: DistributionValue;
  onChange: (value: DistributionValue) => void;
  error?: string;
}

/**
 * Selector transversal de distribución multiportal (plan §5.1).
 * Se usa en boletines, publicaciones, blog, capacitaciones y popups.
 */
export function PortalSelector({ portals, value, onChange, error }: Props) {
  const set = (patch: Partial<DistributionValue>) => onChange({ ...value, ...patch });

  function toggle(id: number) {
    const has = value.portalIds.includes(id);
    set({ portalIds: has ? value.portalIds.filter((p) => p !== id) : [...value.portalIds, id] });
  }

  return (
    <fieldset className="rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Distribución
      </legend>

      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="distributionType"
            checked={value.distributionType === 'specific'}
            onChange={() => set({ distributionType: 'specific', portalIds: [] })}
          />
          Portal específico
        </label>

        {value.distributionType === 'specific' && (
          <select
            value={value.portalIds[0] ?? ''}
            onChange={(e) =>
              set({ portalIds: e.target.value ? [Number(e.target.value)] : [] })
            }
            className="ml-6 w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="">Elige un portal…</option>
            {portals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="distributionType"
            checked={value.distributionType === 'general'}
            onChange={() => set({ distributionType: 'general' })}
          />
          General
        </label>

        {value.distributionType === 'general' && (
          <div className="ml-6 grid grid-cols-2 gap-1.5">
            {portals.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={value.portalIds.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="distributionType"
            checked={value.distributionType === 'all'}
            onChange={() => set({ distributionType: 'all', portalIds: [] })}
          />
          Todos los portales
          <span className="text-xs text-slate-400">(incluye los que se creen luego)</span>
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </fieldset>
  );
}
