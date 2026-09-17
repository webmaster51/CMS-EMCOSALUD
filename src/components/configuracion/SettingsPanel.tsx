import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { appSettingsSchema, type AppSettings } from '@/lib/validations/settings';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';

interface Info {
  appUrl: string;
  timezone: string;
  dbDriver: string;
  storageDriver: string;
  nodeEnv: string;
  users: number;
  maxFileSizeMb: number;
  portals: { name: string; status: string; deployHook: boolean }[];
}

interface Props {
  settings: AppSettings;
  info: Info;
}

export function SettingsPanel({ settings, info }: Props) {
  const [enabled, setEnabled] = useState(settings.blogWebhookEnabled);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AppSettings>({
    resolver: zodResolver(appSettingsSchema),
    defaultValues: settings,
  });

  async function save(values: AppSettings) {
    const res = await apiFetch<AppSettings>('/api/admin/configuracion', {
      method: 'PUT',
      body: JSON.stringify({ ...values, blogWebhookEnabled: enabled }),
    });
    if (res.ok) toast.success('Configuración guardada');
    else toast.error(res.error);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={handleSubmit(save)} className="card space-y-4 p-5 lg:col-span-2">
        <h2 className="text-sm font-semibold text-slate-800">General</h2>
        <TextField
          label="Nombre de la organización"
          error={errors.organizationName?.message}
          {...register('organizationName')}
        />
        <TextField
          label="Correo de soporte"
          type="email"
          error={errors.supportEmail?.message}
          {...register('supportEmail')}
        />
        <TextField
          type="number"
          label="Registros por página (por defecto)"
          error={errors.defaultPageSize?.message}
          {...register('defaultPageSize', { valueAsNumber: true })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Disparar deploy hooks al publicar contenido
        </label>
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={isSubmitting}>
            Guardar
          </Button>
        </div>
      </form>

      <div className="space-y-6">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Sistema</h2>
          <dl className="space-y-1.5 text-sm">
            {[
              ['Entorno', info.nodeEnv],
              ['URL', info.appUrl],
              ['Zona horaria', info.timezone],
              ['Base de datos', info.dbDriver],
              ['Almacenamiento', info.storageDriver],
              ['Usuarios', String(info.users)],
              ['Tamaño máx. de archivo', `${info.maxFileSizeMb} MB`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-slate-400">{k}</dt>
                <dd className="truncate text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Deploy hooks por portal</h2>
          <ul className="space-y-1.5 text-sm">
            {info.portals.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-2">
                <span className="text-slate-600">{p.name}</span>
                {p.deployHook ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-slate-300" />
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Se configuran en cada portal (Portales → editar).
          </p>
        </div>
      </div>
    </div>
  );
}
