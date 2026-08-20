import type {
  FastifyInstance,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { tooMany } from './errors.ts';

interface RequestRateLimitOptions {
  max: number;
  timeWindow: string;
  keyGenerator: (request: FastifyRequest) => string | number;
}

export function createRequestRateLimitHook(
  app: FastifyInstance,
  options: RequestRateLimitOptions,
): preHandlerAsyncHookHandler {
  const check = app.createRateLimit(options);

  return async (request, reply) => {
    const result = await check(request);
    if (result.isAllowed || !result.isExceeded) return;

    reply.header('Retry-After', result.ttlInSeconds);
    throw tooMany();
  };
}
