export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, 'BAD_REQUEST', message, details);
}

export function unauthorized(message = '未登录或登录已过期'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = '没有权限执行该操作'): AppError {
  return new AppError(403, 'FORBIDDEN', message);
}

export function notFound(message = '资源不存在'): AppError {
  return new AppError(404, 'NOT_FOUND', message);
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError(409, 'CONFLICT', message, details);
}

export function tooMany(message = '请求过于频繁，请稍后再试'): AppError {
  return new AppError(429, 'TOO_MANY_REQUESTS', message);
}

export function serviceUnavailable(message = '服务繁忙，请稍后重试'): AppError {
  return new AppError(503, 'SERVICE_UNAVAILABLE', message);
}
