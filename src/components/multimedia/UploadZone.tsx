import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { toast } from '@/components/ui/Toaster';
import type { MediaDTO } from '@/lib/dto/media';

interface Props {
  onUploaded: (media: MediaDTO) => void;
  accept?: string;
  compact?: boolean;
}

export function UploadZone({ onUploaded, accept, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);

  async function uploadOne(file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/media', { method: 'POST', body: form });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = body as { error?: string } | null;
      toast.error(`${file.name}: ${err?.error ?? 'error al subir'}`);
      return;
    }
    onUploaded(body as MediaDTO);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setBusy({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      await uploadOne(list[i]!);
      setBusy({ done: i + 1, total: list.length });
    }
    setBusy(null);
    toast.success(list.length === 1 ? 'Archivo subido' : `${list.length} archivos subidos`);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors ${
        dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-slate-400'
      } ${compact ? 'px-4 py-4' : 'px-6 py-8'}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <UploadCloud className="h-6 w-6 text-slate-400" />
      {busy ? (
        <p className="mt-2 text-sm text-slate-600">
          Subiendo {busy.done}/{busy.total}…
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          Arrastra archivos aquí o <span className="font-medium text-brand-600">búscalos</span>
        </p>
      )}
      {!compact && (
        <p className="mt-0.5 text-xs text-slate-400">
          Imágenes, PDF, Office, ZIP y video · máx. 50 MB
        </p>
      )}
    </div>
  );
}
