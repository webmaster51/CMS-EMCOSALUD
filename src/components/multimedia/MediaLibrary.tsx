import { useState } from 'react';
import { Copy, Download, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/Toaster';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/Field';
import { MediaGrid } from './MediaGrid';
import { UploadZone } from './UploadZone';
import { MediaIcon, KIND_LABEL, humanSize } from './mediaIcon';
import type { MediaDTO } from '@/lib/dto/media';

export default function MediaLibrary() {
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<MediaDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');

  function openDetail(m: MediaDTO) {
    setSelected(m);
    setName(m.internalName ?? '');
  }

  async function saveName() {
    if (!selected) return;
    const res = await apiFetch<MediaDTO>(`/api/admin/media/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ internalName: name || null }),
    });
    if (res.ok) {
      toast.success('Nombre actualizado');
      setSelected(res.data);
      setReloadKey((k) => k + 1);
    } else {
      toast.error(res.error);
    }
  }

  async function remove() {
    if (!selected) return;
    const res = await apiFetch(`/api/admin/media/${selected.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Archivo eliminado');
      setSelected(null);
      setReloadKey((k) => k + 1);
    } else {
      toast.error(res.error);
    }
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url);
    toast.success('URL copiada');
  }

  return (
    <div className="space-y-5">
      <UploadZone onUploaded={() => setReloadKey((k) => k + 1)} />

      <div className="card p-4">
        <MediaGrid onPick={openDetail} reloadKey={reloadKey} />
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.originalName ?? ''}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid place-items-center rounded-lg border border-slate-200 bg-slate-50 p-4">
              {selected.kind === 'image' ? (
                <img
                  src={selected.url}
                  alt=""
                  className="max-h-72 w-auto rounded object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                  <MediaIcon kind={selected.kind} className="h-12 w-12" />
                  <span className="text-xs">{selected.mimeType}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Tipo</span>
              <span className="text-slate-700">
                <Badge tone="neutral">{KIND_LABEL[selected.kind]}</Badge>
              </span>
              <span>Tamaño</span>
              <span className="text-slate-700">{humanSize(selected.sizeBytes)}</span>
              {selected.width && (
                <>
                  <span>Dimensiones</span>
                  <span className="text-slate-700">
                    {selected.width} × {selected.height}px
                  </span>
                </>
              )}
              <span>Subido por</span>
              <span className="text-slate-700">{selected.uploaderName ?? '—'}</span>
            </div>

            <TextField
              label="Nombre interno (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint="Para encontrarlo más fácil en la biblioteca"
            />

            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
              <code className="flex-1 truncate text-xs">{selected.url}</code>
              <button
                onClick={() => copyUrl(selected.url)}
                className="rounded p-1 text-slate-500 hover:bg-slate-200"
                title="Copiar URL"
              >
                <Copy className="h-4 w-4" />
              </button>
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                className="rounded p-1 text-slate-500 hover:bg-slate-200"
                title="Abrir"
              >
                <Download className="h-4 w-4" />
              </a>
            </div>

            <div className="flex justify-between pt-1">
              <Button variant="danger" size="sm" onClick={() => setDeleting(true)}>
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                  Cerrar
                </Button>
                <Button size="sm" onClick={() => void saveName()}>
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Eliminar archivo"
        message={`¿Eliminar "${selected?.originalName}"? Si está en uso por algún contenido, no se podrá eliminar.`}
        confirmLabel="Eliminar"
        onConfirm={remove}
      />
    </div>
  );
}
