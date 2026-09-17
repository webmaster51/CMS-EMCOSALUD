import { Toaster as SonnerToaster } from 'sonner';

/** Contenedor de notificaciones. Se monta una vez en el AdminLayout. */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        style: { fontFamily: 'var(--font-sans)' },
      }}
    />
  );
}

export { toast } from 'sonner';
