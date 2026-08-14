/**
 * 应用组装：Fastify 实例、插件、路由、静态托管、统一错误/404 处理。
 */
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { config } from './config.ts';
import { openDatabase } from './lib/db.ts';
import type { Db } from './lib/db.ts';
import { migrate } from './db/migrate.ts';
import { seed } from './db/seed.ts';
import { buildAuthenticate, buildUserAuthenticate, requireRole } from './lib/auth.ts';
import { AppError, notFound } from './lib/errors.ts';
import { nowIso } from './lib/time.ts';
import { registerPublicRoutes } from './routes/public.ts';
import { registerAdminRoutes } from './routes/admin.ts';
import { registerUserRoutes } from './routes/user.ts';

export interface AppHandle {
  app: FastifyInstance;
  db: Db;
  bootSummary: {
    migrationsApplied: number[];
    adminCreated: boolean;
    roundCreated: boolean;
    slotsCreated: number;
  };
}

function isDev(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.CRA_DEV === '1';
}

export async function buildApp(): Promise<AppHandle> {
  const db = openDatabase();
  const migrationResult = migrate(db);
  const seedResult = seed(db);

  const app = Fastify({
    logger: isDev()
      ? {
          level: config.logLevel,
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' },
          },
        }
      : { level: config.logLevel },
    trustProxy: true,
  });

  // 安全响应头（管理端/报名页均为自有静态资源，不需要 CSP 的额外配置）
  await app.register(fastifyHelmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: false });

  // CORS：默认同源（生产），开发时通过 CRA_CORS_ORIGINS 配置 vite dev server 来源
  if (config.corsOrigins.length > 0) {
    await app.register(fastifyCors, { origin: config.corsOrigins, credentials: false });
  }

  // 全局限流兜底（登录等敏感接口另有更严配置）
  await app.register(fastifyRateLimit, {
    max: 600,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: { code: 'TOO_MANY_REQUESTS', message: '请求过于频繁，请稍后再试' },
    }),
  });

  await app.register(fastifyJwt, { secret: config.jwtSecret });

  // 统一错误格式：{ error: { code, message, details? } }
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      const body: Record<string, unknown> = { code: error.code, message: error.message };
      if (error.details !== undefined) body.details = error.details;
      reply.code(error.statusCode).send({ error: body });
      return;
    }
    if (typeof error === 'object' && error !== null && 'validation' in error) {
      const validation = (error as { validation?: unknown }).validation;
      request.log.warn({ err: error }, 'validation failed');
      reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: '请求参数校验失败', details: validation },
      });
      return;
    }
    if (typeof error === 'object' && error !== null && (error as { statusCode?: number }).statusCode === 429) {
      reply.code(429).send({ error: { code: 'TOO_MANY_REQUESTS', message: '请求过于频繁，请稍后再试' } });
      return;
    }
    if (typeof error === 'object' && error !== null && (error as { statusCode?: number }).statusCode === 415) {
      reply.code(415).send({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: '请求体格式不支持，请使用 application/json' } });
      return;
    }
    request.log.error(error);
    reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } });
  });

  // 业务路由
  app.get('/api/health', async () => ({ status: 'ok', time: nowIso(), version: '1.0.0' }));
  registerPublicRoutes(app, db);
  registerAdminRoutes(app, db, { authenticate: buildAuthenticate(db), requireRole });
  registerUserRoutes(app, db, { authenticateUser: buildUserAuthenticate(db) });

  // 静态托管（生产形态：单一进程同时服务 报名端 + 管理端 + API）
  // 注意：index.html 不缓存，SPA fallback 时实时读取，前端重新构建后无需重启服务
  if (config.adminDistDir && existsSync(join(config.adminDistDir, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: config.adminDistDir,
      prefix: '/admin/',
      wildcard: true,
      index: ['index.html'],
    });
    app.log.info(`管理端静态资源: ${config.adminDistDir} -> /admin/`);
  }

  if (config.userDistDir && existsSync(join(config.userDistDir, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: config.userDistDir,
      prefix: '/user/',
      wildcard: true,
      index: ['index.html'],
      decorateReply: false,
    });
    app.log.info(`用户端静态资源: ${config.userDistDir} -> /user/`);
  }

  if (config.webDistDir && existsSync(join(config.webDistDir, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: config.webDistDir,
      prefix: '/',
      wildcard: true,
      index: ['index.html'],
      decorateReply: false,
    });
    app.log.info(`报名端静态资源: ${config.webDistDir} -> /`);
  }

  // 未命中处理：API 返回 JSON 404；页面路由做 SPA fallback（实时读取 index.html）
  app.setNotFoundHandler((request, reply) => {
    const url = request.url.split('?')[0] ?? '';
    if (url.startsWith('/api/')) {
      throw notFound('接口不存在');
    }
    if (url.startsWith('/admin') && config.adminDistDir) {
      const adminIndex = readIndexHtml(config.adminDistDir);
      if (adminIndex) {
        reply.type('text/html; charset=utf-8');
        return reply.send(adminIndex);
      }
    }
    if (url.startsWith('/user') && config.userDistDir) {
      const userIndex = readIndexHtml(config.userDistDir);
      if (userIndex) {
        reply.type('text/html; charset=utf-8');
        return reply.send(userIndex);
      }
    }
    if (config.webDistDir) {
      const webIndex = readIndexHtml(config.webDistDir);
      if (webIndex) {
        reply.type('text/html; charset=utf-8');
        return reply.send(webIndex);
      }
    }
    throw notFound();
  });

  return { app, db, bootSummary: { migrationsApplied: migrationResult.applied, ...seedResult } };
}

function readIndexHtml(dir: string | null): string | null {
  if (!dir) return null;
  const file = join(dir, 'index.html');
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}
