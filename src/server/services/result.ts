/** Resultado uniforme de las operaciones de servicio. */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: number;
      error: string;
      /** Errores por campo para formularios. */
      fieldErrors?: Record<string, string>;
    };

export const fail = (
  status: number,
  error: string,
  fieldErrors?: Record<string, string>,
): ServiceResult<never> => ({ ok: false, status, error, fieldErrors });

export const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
