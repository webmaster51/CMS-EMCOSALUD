import { Button } from './Button';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPage }: Props) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
      <span className="text-slate-500">
        {total.toLocaleString('es-CO')} {total === 1 ? 'registro' : 'registros'}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Anterior
        </Button>
        <span className="text-slate-500">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
