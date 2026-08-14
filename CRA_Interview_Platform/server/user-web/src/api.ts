/**
 * 用户端 API 客户端：统一鉴权头、错误解析、401 跳转。
 */
import { authStore } from './auth';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`;

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    // 登录态失效：清理并跳转登录页（生产托管在 /user/ 前缀下）
    authStore.clear();
    const loginPath = `${import.meta.env.DEV ? '' : '/user'}/login`;
    if (window.location.pathname !== loginPath) {
      window.location.href = loginPath;
    }
    throw new ApiError(401, 'UNAUTHORIZED', '登录已过期，请重新登录');
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('Content-Type') ?? '';
  let payload: unknown = null;
  if (contentType.includes('application/json')) {
    payload = await response.json();
  }

  if (!response.ok) {
    const errorBody = payload as { error?: { code?: string; message?: string; details?: unknown } } | null;
    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? 'HTTP_ERROR',
      errorBody?.error?.message ?? `请求失败（${response.status}）`,
      errorBody?.error?.details,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
};
