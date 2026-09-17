import { useState } from 'react';
import { FilePlus2, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { MediaGrid } from './MediaGrid';
import { UploadZone } from './UploadZone';
import { MediaIcon } from './mediaIcon';
import type { MediaDTO } from '@/lib/dto/media';
import type { MediaKind } from '@/lib/storage/mime';

export interface PickedMedia {
  id: string;
  url: string | null;
  name?: string;
  kind?: MediaKind;
}

interface Props {
  label: string;
  /** Restringe la biblioteca a un tipo. Si se omite, admite cualquier archivo. */
  lockKind?: MediaKind;
  accept?: string;
  hint?: string;
  error?: string;
  value?: PickedMedia | null;
  onChange: (media: PickedMedia | null) => void;
}

export function MediaPicker({
  label,
  lockKind,
  accept,
  hint,
  error,
  value,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [current, setCurrent] = useState<PickedMedia | null>(value ?? null);

  function pick(m: MediaDTO) {
    const next: PickedMedia = {
      id: m.id,
      url: m.thumbnailUrl ?? m.url,
      name: m.internalName ?? m.originalName,
      kind: m.kind,
    };
    setCurrent(next);
    onChange(next);
    setOpen(false);
  }

  return (
    <div className="text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>

      {current ? (
        <div className="flex items-center gap-3 rounded-md border border-slate-200 p-2">
          {(current.kind === 'image' || lockKind === 'image') && current.url ? (
            <img src={current.url} alt="" className="h-12 w-12 rounded object-cover" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded bg-slate-100 text-slate-400">
              <MediaIcon kind={current.kind ?? lockKind ?? 'other'} className="h-5 w-5" />
            </span>
          )}
          <span className="flex-1 truncate text-slate-700">
            {current.name ?? 'Archivo seleccionado'}
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs text-brand-600 hover:underline"
          >
            Cambiar
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrent(null);
              onChange(null);
            }}
            className="rounded p-1 text-slate-400 hover:bg-danger-bg hover:text-danger"
            title="Quitar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed py-3 text-slate-400 hover:border-slate-400 ${
            error ? 'border-danger' : 'border-slate-300'
          }`}
        >
          <FilePlus2 className="h-4 w-4" />
          Seleccionar
        </button>
      )}

      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen} title={`Seleccionar — ${label}`} size="lg">
        <div className="space-y-4">
          <UploadZone
            compact
            accept={accept}
            onUploaded={(m) => {
              setReloadKey((k) => k + 1);
              if (!lockKind || m.kind === lockKind) pick(m);
            }}
          />
          <MediaGrid
            lockKind={lockKind}
            onPick={pick}
            selectedId={current?.id}
            reloadKey={reloadKey}
          />
        </div>
      </Dialog>
    </div>
  );
}
