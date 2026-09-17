import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-50 text-brand-700',
  accent: 'bg-accent-50 text-accent-700',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
};

/** Mapeo de estados de contenido del CMS a un tono visual. */
export const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  scheduled: 'info',
  published: 'success',
  active: 'success',
  inactive: 'neutral',
  archived: 'warning',
  finished: 'neutral',
  suspended: 'danger',
};

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programado',
  published: 'Publicado',
  active: 'Activo',
  inactive: 'Inactivo',
  archived: 'Archivado',
  finished: 'Finalizado',
  suspended: 'Suspendido',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
