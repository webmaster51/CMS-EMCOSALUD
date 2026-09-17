import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, KeyRound, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { apiKeyInputSchema, type ApiKeyInput } from '@/lib/validations/portal';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/Field';
import type { ApiKeyDTO } from '@/lib/dto/portal';

interface Props {
  portalId: number;
  initial: ApiKeyDTO[];
}

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso)) : '—';

export default function ApiKeysPanel({ portalId, initial }: Props) {
  const [keys, setKeys] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyDTO | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<ApiKeyInput>({
    resolver: zodResolver(apiKeyInputSchema),
    defaultValues: { name: '' },
  });

  async function reload() {
    const res = await apiFetch<ApiKeyDTO[]>(`/api/admin/portales/${portalId}/api-keys`);
    if (res.ok) setKeys(res.data);
  }

  async function create(values: ApiKeyInput) {
    const res = await apiFetch<{ id: number; plaintext: string }>(
      `/api/admin/portales/${portalId}/api-keys`,
      { method: 'POST', body: JSON.stringify(values) },
    );
    if (res.ok) {
      setCreating(false);
      reset();
      setPlaintext(res.data.plaintext);
      void reload();
    } else {
      toast.error(res.error);
    }
  }

  async function revoke() {
    if (!revoking) return;
    const res = await apiFetch(
      `/api/admin/portales/${portalId}/api-keys/${revoking.id}`,
      { method: 'DELETE' },
    );
    if (res.ok) {
      toast.success('Clave revocada');
      void reload();
    } else {
      toast.error(res.error);
    }
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Cada sitio usa su clave en la cabecera <code>x-api-key</code> para leer su contenido.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nueva clave
        </Button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2.5 font-medium">Nombre</th>
              <th className="px-3 py-2.5 font-medium">Prefijo</th>
              <th className="px-3 py-2.5 font-medium">Creada</th>
              <th className="px-3 py-2.5 font-medium">Último uso</th>
              <th className="px-3 py-2.5 font-medium">Estado</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  Sin claves. Crea una para conectar el sitio.
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-2.5 font-medium text-slate-700">{k.name}</td>
                <td className="px-3 py-2.5">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {k.keyPrefix}…
                  </code>
                </td>
                <td className="px-3 py-2.5 text-slate-500">{fmt(k.createdAt)}</td>
                <td className="px-3 py-2.5 text-slate-500">{fmt(k.lastUsedAt)}</td>
                <td className="px-3 py-2.5">
                  {k.revokedAt ? (
                    <Badge tone="danger">Revocada</Badge>
                  ) : (
                    <Badge tone="success">Activa</Badge>
                  )}
                </td>
                <td className="px-5 py-2.5 text-right">
                  {!k.revokedAt && (
                    <button
                      onClick={() => setRevoking(k)}
                      className="text-xs font-medium text-danger hover:underline"
                    >
                      Revocar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="Nueva clave de API"
        size="sm"
      >
        <form onSubmit={handleSubmit(create)} className="space-y-4">
          <TextField
            label="Nombre"
            required
            hint="Para identificar dónde se usa (p. ej. 'Sitio Emcosalud - producción')"
            error={formState.errors.name?.message}
            {...register('name')}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={formState.isSubmitting}>
              Generar
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={plaintext !== null}
        onOpenChange={(o) => !o && setPlaintext(null)}
        title="Clave generada"
        description="Cópiala ahora: no se volverá a mostrar."
        size="md"
        footer={
          <Button size="sm" onClick={() => setPlaintext(null)}>
            Entendido
          </Button>
        }
      >
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <KeyRound className="h-4 w-4 shrink-0 text-brand-600" />
          <code className="flex-1 break-all text-xs">{plaintext}</code>
          <button
            onClick={() => plaintext && copy(plaintext)}
            className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-200"
            title="Copiar"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revocar clave"
        message={`La clave "${revoking?.name}" dejará de funcionar de inmediato. El sitio que la use perderá acceso a la API.`}
        confirmLabel="Revocar"
        onConfirm={revoke}
      />
    </div>
  );
}
