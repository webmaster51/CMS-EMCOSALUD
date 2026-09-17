import { Fragment, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { AuditEntryDTO } from '@/server/repositories/auditRepository';
import type { PagedDTO } from '@/lib/dto/portal';

interface Props {
  initial: PagedDTO<AuditEntryDTO> & { facets?: { modules: string[]; actions: string[] } };
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));

export default function AuditTable({ initial }: Props) {
  const [paged, setPaged] = useState<PagedDTO<AuditEntryDTO>>(initial);
  const [facets] = useState(initial.facets ?? { modules: [], actions: [] });
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(
    async (page: number) => {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (module) params.set('module', module);
      if (action) params.set('action', action);
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to).toISOString());
      const res = await apiFetch<PagedDTO<AuditEntryDTO>>(`/api/admin/auditoria?${params}`);
      if (res.ok) setPaged(res.data);
      else toast.error(res.error);
    },
    [module, action, from, to],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Módulo</span>
          <select
            value={module}
            onChange={(e) => setModule(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {facets.modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Acción</span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {facets.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-medium">Fecha</th>
                <th className="px-3 py-2.5 font-medium">Usuario</th>
                <th className="px-3 py-2.5 font-medium">Módulo</th>
                <th className="px-3 py-2.5 font-medium">Acción</th>
                <th className="px-3 py-2.5 font-medium">Detalle</th>
                <th className="px-5 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {paged.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    Sin registros.
                  </td>
                </tr>
              )}
              {paged.data.map((e) => (
                <Fragment key={e.id}>
                  <tr
                    className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    <td className="whitespace-nowrap px-5 py-2 text-slate-500">
                      {fmt(e.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {e.userName ?? (e.userId ? '—' : 'Sistema')}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone="neutral">{e.module}</Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{e.action}</td>
                    <td className="px-3 py-2 text-slate-700">{e.summary}</td>
                    <td className="px-5 py-2 text-slate-400">{e.ip ?? '—'}</td>
                  </tr>
                  {expanded === e.id && (
                    <tr className="border-b border-slate-50 bg-slate-50/60">
                      <td colSpan={6} className="px-5 py-3">
                        <pre className="max-h-56 overflow-auto rounded bg-white p-3 text-xs text-slate-600">
                          {JSON.stringify(
                            {
                              entityType: e.entityType,
                              entityId: e.entityId,
                              userEmail: e.userEmail,
                              metadata: e.metadata,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={paged.meta.page}
          totalPages={paged.meta.totalPages}
          total={paged.meta.total}
          onPage={(page) => void load(page)}
        />
      </div>
    </div>
  );
}
