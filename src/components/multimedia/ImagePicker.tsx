import { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { MediaGrid } from './MediaGrid';
import { UploadZone } from './UploadZone';
import type { MediaDTO } from '@/lib/dto/media';

interface Props {
  label?: string;
  /** Vista previa inicial (al editar). */
  value?: { id: string; url: string } | null;
  onChange: (media: { id: string; url: string } | null) => void;
}

/** Selector de imagen que abre la biblioteca multimedia. Devuelve el id del medio. */
export function ImagePicker({ label = 'Imagen', value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [current, setCurrent] = useState<{ id: string; url: string } | null>(value ?? null);

  function pick(m: MediaDTO) {
    const next = { id: m.id, url: m.thumbnailUrl ?? m.url };
    setCurrent(next);
    onChange(next);
    setOpen(false);
  }

  function clear() {
    setCurrent(null);
    onChange(null);
  }

  return (
    <div className="text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {current ? (
        <div className="relative inline-block">
          <img
            src={current.url}
            alt=""
            className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
          />
          <button
            type="button"
            onClick={clear}
            className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-slate-700 text-white hover:bg-danger"
            title="Quitar"
          >
            <X className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-1 block text-xs text-brand-600 hover:underline"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-400"
        >
          <ImagePlus className="h-5 w-5" />
          <span className="text-[0.7rem]">Seleccionar</span>
        </button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Seleccionar imagen"
        size="lg"
      >
        <div className="space-y-4">
          <UploadZone
            compact
            accept="image/*"
            onUploaded={(m) => {
              setReloadKey((k) => k + 1);
              pick(m);
            }}
          />
          <MediaGrid
            lockKind="image"
            onPick={pick}
            selectedId={current?.id}
            reloadKey={reloadKey}
          />
        </div>
      </Dialog>
    </div>
  );
}
