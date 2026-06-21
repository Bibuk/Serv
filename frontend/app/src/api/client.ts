const BASE_URL = '';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function setUnauthorizedHandler(_fn: () => void) {
  void _fn;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (r.ok) return true;
        if (r.status === 401 || r.status === 403) return false;
      } catch {
      }
      if (attempt < 2) await new Promise<void>(r => setTimeout(r, 1500 * (attempt + 1)));
    }
    return false;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function refreshAccessToken(): Promise<boolean> {
  return tryRefreshToken();
}

async function fetchRaw(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      (body as { detail?: string }).detail ?? res.statusText,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchRaw(path, init);

  if (res.status !== 401) return handleResponse<T>(res);

  if (path === '/auth/refresh' || path === '/auth/login') {
    throw new ApiError(401, 'Неверные учётные данные.');
  }

  const refreshed = await tryRefreshToken();
  if (!refreshed) {
    throw new ApiError(401, 'Токен обновления недоступен.');
  }

  const retry = await fetchRaw(path, init);
  if (retry.status === 401) {
    throw new ApiError(401, 'Доступ запрещён.');
  }
  return handleResponse<T>(retry);
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T = void>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
