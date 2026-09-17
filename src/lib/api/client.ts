/** Cliente fetch para las islas del panel: JSON, credenciales, errores uniformes. */
export interface ApiError {
  error: string;
  fieldErrors?: Record<string, string>;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; fieldErrors?: Record<string, string> };

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } catch {
    return { ok: false, status: 0, error: 'No hay conexión con el servidor' };
  }

  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = (body ?? {}) as ApiError;
    return {
      ok: false,
      status: res.status,
      error: err.error ?? `Error ${res.status}`,
      fieldErrors: err.fieldErrors,
    };
  }
  return { ok: true, data: body as T };
}
