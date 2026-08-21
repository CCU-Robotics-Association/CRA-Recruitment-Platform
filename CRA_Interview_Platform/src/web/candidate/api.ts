import { candidateAuth } from './auth';

export class CandidateApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'CandidateApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface CandidateRequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: CandidateRequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function request<T>(path: string, options: CandidateRequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && candidateAuth.csrfToken) {
    headers['X-CSRF-Token'] = candidateAuth.csrfToken;
  }

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    credentials: 'same-origin',
    cache: method === 'GET' ? 'no-store' : 'default',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const contentType = response.headers.get('Content-Type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const errorBody = payload as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;

    if (response.status === 401 && path !== '/api/user/auth/login') {
      candidateAuth.clear();
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?redirect=${redirect}`);
    }

    throw new CandidateApiError(
      response.status,
      errorBody?.error?.code ?? 'HTTP_ERROR',
      errorBody?.error?.message ?? `请求失败（${response.status}）`,
      errorBody?.error?.details,
    );
  }

  return payload as T;
}

export const candidateApi = {
  get: <T>(path: string, query?: CandidateRequestOptions['query']) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
};
