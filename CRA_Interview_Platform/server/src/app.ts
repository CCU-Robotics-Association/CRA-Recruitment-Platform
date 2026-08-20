import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { config } from './config.ts';
import { openDatabase } from './lib/db.ts';
import type { Db } from './lib/db.ts';
import { migrate } from './db/migrate.ts';
import { seed } from './db/seed.ts';
import { buildAuthenticate, buildUserAuthenticate, requireRole } from './lib/auth.ts';
import { AppError, forbidden, notFound } from './lib/errors.ts';
import { verifyPassword } from './lib/password.ts';
import { closeMailer } from './lib/mailer.ts';
import { nowIso } from './lib/time.ts';
import { registerPublicRoutes } from './routes/public.ts';
import { registerAdminRoutes } from './routes/admin.ts';
import { registerUserRoutes } from './routes/user.ts';
import { assertDatabaseIntegrity, checkDatabaseReadiness } from './lib/health.ts';
import { pruneLoginFailures } from './lib/loginThrottle.ts';

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

export interface BuildAppOptions {
  dbPath?: string;
  logger?: boolean;
}

function isDev(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.CRA_DEV === '1';
}

function setStaticCacheHeaders(response: FastifyReply, filePath: string): void {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.html') {
    response.header('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    return;
  }

  const fileName = basename(filePath);
  if (/-[a-zA-Z0-9_]{8,}\.(?:js|css)$/.test(fileName)) {
    response.header('Cache-Control', 'public, max-age=31536000, immutable');
    return;
  }

  if (/^\.(?:woff2?|ttf|png|jpe?g|webp|svg|mp4|glb)$/.test(extension)) {
    response.header('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    return;
  }

  response.header('Cache-Control', 'public, max-age=86400, must-revalidate');
}

function sendIndexHtml(reply: FastifyReply, html: string) {
  reply.header('Cache-Control', 'no-cache, max-age=0, must-revalidate');
  reply.type('text/html; charset=utf-8');
  return reply.send(html);
}

function allowedRequestOrigins(): Set<string> {
  const origins = new Set(config.corsOrigins);
  if (config.publicOrigin) origins.add(config.publicOrigin);
  if (!config.isProduction) {
    for (const port of [3000, 5173, 5174]) {
      origins.add(`http://localhost:${port}`);
      origins.add(`http://127.0.0.1:${port}`);
    }
  }
  return origins;
}

async function assertNoDefaultProductionPassword(db: Db): Promise<void> {
  if (!config.isProduction) return;
  const rows = db
    .prepare("SELECT username, password_hash FROM users WHERE is_active = 1 AND role = 'super_admin'")
    .all() as Array<{ username: string; password_hash: string }>;
  for (const row of rows) {
    if (await verifyPassword('admin123456', row.password_hash)) {
      throw new Error(`管理员 ${row.username} 仍在使用开发默认密码，拒绝以生产模式启动`);
    }
  }
}

export async function buildApp(options: BuildAppOptions = {}): Promise<AppHandle> {
  const db = openDatabase(options.dbPath);
  let migrationResult: ReturnType<typeof migrate>;
  let seedResult: Awaited<ReturnType<typeof seed>>;
  let prunedLoginFailures: number;
  try {
    migrationResult = migrate(db);
    seedResult = await seed(db);
    assertDatabaseIntegrity(db);
    prunedLoginFailures = pruneLoginFailures(db);
    await assertNoDefaultProductionPassword(db);
  } catch (error) {
    db.close();
    throw error;
  }

  const redact = {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  };
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : isDev()
          ? {
              level: config.logLevel,
              redact,
              transport: {
                target: 'pino-pretty',
                options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' },
              },
            }
          : { level: config.logLevel, redact },
    trustProxy: config.trustProxy,
    bodyLimit: config.bodyLimitBytes,
    connectionTimeout: config.connectionTimeoutMs,
    requestTimeout: config.requestTimeoutMs,
    handlerTimeout: config.handlerTimeoutMs,
  });
  app.addHook('onClose', async () => {
    closeMailer();
  });
  if (prunedLoginFailures > 0) app.log.info({ count: prunedLoginFailures }, '已清理过期登录失败记录');

  app.addHook('onClose', async () => {
    db.close();
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        scriptSrc: ["'self'"],
        upgradeInsecureRequests: config.isProduction ? [] : null,
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        manifestSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    strictTransportSecurity: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });

  if (config.corsOrigins.length > 0) {
    await app.register(fastifyCors, { origin: config.corsOrigins, credentials: true });
  }

  await app.register(fastifyRateLimit, {
    max: 600,
    timeWindow: '1 minute',
    allowList: (request) => !request.url.startsWith('/api/'),
  });

  await app.register(fastifyCookie);
  await app.register(fastifyJwt, { secret: config.jwtSecret });

  const allowedOrigins = allowedRequestOrigins();
  app.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    if (request.headers['sec-fetch-site'] === 'cross-site') {
      throw forbidden('拒绝跨站请求');
    }
    const originHeader = request.headers.origin;
    if (originHeader && !allowedOrigins.has(originHeader)) {
      throw forbidden('请求来源不受信任');
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Request-Id', request.id);
    if (request.url.startsWith('/api/admin/') || request.url.startsWith('/api/user/')) {
      reply.header('Cache-Control', 'no-store');
      reply.header('Pragma', 'no-cache');
    }
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (reply.sent || reply.raw.destroyed) {
      request.log.warn({ err: error }, 'request ended before the handler completed');
      return;
    }
    if (error instanceof AppError) {
      if (error.statusCode === 503) reply.header('Retry-After', '2');
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
    if (typeof error === 'object' && error !== null && (error as { statusCode?: number }).statusCode === 413) {
      reply.code(413).send({ error: { code: 'PAYLOAD_TOO_LARGE', message: '请求内容过大' } });
      return;
    }
    if (typeof error === 'object' && error !== null && (error as { statusCode?: number }).statusCode === 503) {
      reply.header('Retry-After', '2');
      reply.code(503).send({ error: { code: 'SERVICE_UNAVAILABLE', message: '服务繁忙，请稍后重试' } });
      return;
    }
    request.log.error(error);
    reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } });
  });

  app.get('/api/health/live', async () => ({ status: 'alive', time: nowIso(), version: '1.0.0' }));
  const readinessHandler = async (_request: unknown, reply: FastifyReply) => {
    try {
      return { ...checkDatabaseReadiness(db), time: nowIso(), version: '1.0.0' };
    } catch (error) {
      app.log.error({ err: error }, 'readiness check failed');
      return reply.code(503).send({ status: 'not_ready', database: 'error', time: nowIso(), version: '1.0.0' });
    }
  };
  app.get('/api/health', readinessHandler);
  app.get('/api/health/ready', readinessHandler);
  registerPublicRoutes(app, db);
  registerAdminRoutes(app, db, { authenticate: buildAuthenticate(app, db), requireRole });
  registerUserRoutes(app, db, { authenticateUser: buildUserAuthenticate(app, db) });

  if (config.adminDistDir && existsSync(join(config.adminDistDir, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: config.adminDistDir,
      prefix: '/admin/',
      wildcard: true,
      index: ['index.html'],
      cacheControl: false,
      setHeaders: setStaticCacheHeaders,
    });
    app.log.info(`管理端静态资源: ${config.adminDistDir} -> /admin/`);
  }

  if (config.webDistDir && existsSync(join(config.webDistDir, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: config.webDistDir,
      prefix: '/',
      wildcard: true,
      index: ['index.html'],
      decorateReply: false,
      cacheControl: false,
      setHeaders: setStaticCacheHeaders,
    });
    app.log.info(`官网静态资源: ${config.webDistDir} -> /`);
  }

  app.setNotFoundHandler((request, reply) => {
    const url = request.url.split('?')[0] ?? '';
    if (url.startsWith('/api/')) throw notFound('接口不存在');
    if (url.startsWith('/admin') && config.adminDistDir) {
      const adminIndex = readIndexHtml(config.adminDistDir);
      if (adminIndex) {
        return sendIndexHtml(reply, adminIndex);
      }
    }
    if (config.webDistDir) {
      const webIndex = readIndexHtml(config.webDistDir);
      if (webIndex) {
        return sendIndexHtml(reply, webIndex);
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
