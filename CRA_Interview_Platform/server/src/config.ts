import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export interface AppConfig {
  port: number;
  host: string;
  dataDir: string;
  dbPath: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  webDistDir: string | null;
  adminDistDir: string | null;
  corsOrigins: string[];
  publicOrigin: string | null;
  trustProxy: boolean | string | string[];
  cookieSecure: boolean;
  isProduction: boolean;
  bodyLimitBytes: number;
  connectionTimeoutMs: number;
  requestTimeoutMs: number;
  handlerTimeoutMs: number;
  passwordConcurrency: number;
  passwordQueueLimit: number;
  seedDemoData: boolean;
  bootstrapAdmin: { username: string; password: string; displayName: string };
  logLevel: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  } | null;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boundedInt(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} 必须在 ${minimum} 到 ${maximum} 之间`);
  }
  return parsed;
}

function resolveDataDir(env: NodeJS.ProcessEnv, isProduction: boolean): { dataDir: string; dbPath: string } {
  const configured = env.CRA_DATA_DIR?.trim();
  if (isProduction && !configured) {
    throw new Error('生产环境必须显式配置 CRA_DATA_DIR，并挂载到持久化磁盘');
  }
  if (isProduction && configured && !isAbsolute(configured)) {
    throw new Error('生产环境 CRA_DATA_DIR 必须是绝对路径');
  }
  const base = configured ? resolve(configured) : resolve(process.cwd(), 'data');
  mkdirSync(base, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') chmodSync(base, 0o700);
  return { dataDir: base, dbPath: join(base, env.CRA_DB_FILE ?? 'cra.db') };
}

function resolveJwtSecret(dataDir: string, env: NodeJS.ProcessEnv, isProduction: boolean): string {
  const fromEnv = env.CRA_JWT_SECRET?.trim();
  if (fromEnv) {
    if (fromEnv.length < 32) throw new Error('CRA_JWT_SECRET 至少需要 32 个字符');
    if (isProduction && /change.?me|replace.?with|example|placeholder/i.test(fromEnv)) {
      throw new Error('生产环境 CRA_JWT_SECRET 不能使用示例占位值');
    }
    return fromEnv;
  }
  if (isProduction) throw new Error('生产环境必须通过环境变量或密钥管理服务配置 CRA_JWT_SECRET');

  const secretFile = join(dataDir, '.jwt-secret');
  if (existsSync(secretFile)) {
    const stored = readFileSync(secretFile, 'utf8').trim();
    if (stored.length < 32) throw new Error('data/.jwt-secret 无效，请删除后重新启动');
    return stored;
  }
  const generated = randomBytes(48).toString('base64url');
  writeFileSync(secretFile, generated, { encoding: 'utf8', mode: 0o600 });
  return generated;
}

function normalizeOrigin(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} 不是有效的网址`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${label} 仅支持 http 或 https`);
  if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error(`${label} 必须只填写站点来源，例如 https://cra.example.com`);
  }
  return parsed.origin;
}

function resolveCorsOrigins(env: NodeJS.ProcessEnv): string[] {
  const raw = env.CRA_CORS_ORIGINS;
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(',').map((value) => normalizeOrigin(value.trim(), 'CRA_CORS_ORIGINS')))];
}

function resolveSmtp(env: NodeJS.ProcessEnv, isProduction: boolean): AppConfig['smtp'] {
  const host = env.CRA_SMTP_HOST?.trim();
  const user = env.CRA_SMTP_USER?.trim();
  const pass = env.CRA_SMTP_PASS;
  const from = env.CRA_SMTP_FROM?.trim();
  if (!host || !user || !pass || !from) {
    if (isProduction) {
      throw new Error('生产环境必须完整配置 CRA_SMTP_HOST、CRA_SMTP_USER、CRA_SMTP_PASS 和 CRA_SMTP_FROM');
    }
    return null;
  }
  if (
    isProduction &&
    /change.?me|replace.?me|replace.?with|example|placeholder/i.test(pass)
  ) {
    throw new Error('生产环境 CRA_SMTP_PASS 不能使用示例占位值');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from.replace(/^.*<([^>]+)>$/, '$1'))) {
    throw new Error('CRA_SMTP_FROM 必须包含有效邮箱地址');
  }
  const port = boundedInt(env.CRA_SMTP_PORT, 465, 1, 65535, 'CRA_SMTP_PORT');
  return { host, port, secure: bool(env.CRA_SMTP_SECURE, port === 465), user, pass, from };
}

function resolvePublicOrigin(env: NodeJS.ProcessEnv, isProduction: boolean): string | null {
  const raw = env.CRA_PUBLIC_ORIGIN?.trim();
  if (!raw) {
    if (isProduction) throw new Error('生产环境必须配置 CRA_PUBLIC_ORIGIN');
    return null;
  }
  const origin = normalizeOrigin(raw, 'CRA_PUBLIC_ORIGIN');
  if (isProduction && !origin.startsWith('https://')) throw new Error('生产环境 CRA_PUBLIC_ORIGIN 必须使用 HTTPS');
  return origin;
}

function resolveTrustProxy(env: NodeJS.ProcessEnv, isProduction: boolean): boolean | string | string[] {
  const raw = env.CRA_TRUST_PROXY?.trim();
  if (!raw || raw.toLowerCase() === 'false') return false;
  if (raw.toLowerCase() === 'true') {
    if (isProduction) throw new Error('生产环境 CRA_TRUST_PROXY 不得设为 true，请填写代理 IP 或 CIDR');
    return true;
  }
  const entries = raw.split(',').map((value) => value.trim()).filter(Boolean);
  return entries.length === 1 ? entries[0]! : entries;
}

function resolveWebDist(): string | null {
  const raw = process.env.CRA_WEB_DIST;
  if (raw === undefined) return resolve(process.cwd(), '..', 'dist', 'web');
  if (raw === '') return null;
  return resolve(raw);
}

function resolveAdminDist(): string | null {
  const raw = process.env.CRA_ADMIN_DIST;
  if (raw === undefined) return resolve(process.cwd(), '..', 'dist', 'admin');
  if (raw === '') return null;
  return resolve(raw);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = env.NODE_ENV === 'production' || env.CRA_ENV === 'production';
  const { dataDir, dbPath } = resolveDataDir(env, isProduction);
  const jwtExpiresInSeconds = int(env.CRA_JWT_EXPIRES_IN, 60 * 60 * 12);
  if (jwtExpiresInSeconds < 300 || jwtExpiresInSeconds > 24 * 60 * 60) {
    throw new Error('CRA_JWT_EXPIRES_IN 必须在 300 到 86400 秒之间');
  }
  const adminPassword = env.CRA_ADMIN_PASSWORD ?? 'admin123456';
  if (
    isProduction &&
    (!env.CRA_ADMIN_PASSWORD ||
      adminPassword.length < 12 ||
      adminPassword === 'admin123456' ||
      /change.?me|replace.?with|example|placeholder/i.test(adminPassword))
  ) {
    throw new Error('生产环境必须显式配置至少 12 位且非占位值的 CRA_ADMIN_PASSWORD');
  }
  const seedDemoData = bool(env.CRA_SEED_DEMO_DATA, !isProduction);
  if (isProduction && seedDemoData) throw new Error('生产环境禁止启用 CRA_SEED_DEMO_DATA');
  const smtp = resolveSmtp(env, isProduction);

  return {
    port: int(env.CRA_PORT, 3000),
    host: env.CRA_HOST ?? (isProduction ? '0.0.0.0' : '127.0.0.1'),
    dataDir,
    dbPath,
    jwtSecret: resolveJwtSecret(dataDir, env, isProduction),
    jwtExpiresInSeconds,
    webDistDir: resolveWebDist(),
    adminDistDir: resolveAdminDist(),
    corsOrigins: resolveCorsOrigins(env),
    publicOrigin: resolvePublicOrigin(env, isProduction),
    trustProxy: resolveTrustProxy(env, isProduction),
    cookieSecure: isProduction || bool(env.CRA_COOKIE_SECURE, false),
    isProduction,
    bodyLimitBytes: boundedInt(env.CRA_BODY_LIMIT_BYTES, 128 * 1024, 16 * 1024, 2 * 1024 * 1024, 'CRA_BODY_LIMIT_BYTES'),
    connectionTimeoutMs: boundedInt(env.CRA_CONNECTION_TIMEOUT_MS, 10_000, 1_000, 120_000, 'CRA_CONNECTION_TIMEOUT_MS'),
    requestTimeoutMs: boundedInt(env.CRA_REQUEST_TIMEOUT_MS, 15_000, 5_000, 120_000, 'CRA_REQUEST_TIMEOUT_MS'),
    handlerTimeoutMs: boundedInt(env.CRA_HANDLER_TIMEOUT_MS, 60_000, 1_000, 120_000, 'CRA_HANDLER_TIMEOUT_MS'),
    passwordConcurrency: boundedInt(env.CRA_PASSWORD_CONCURRENCY, 4, 1, 32, 'CRA_PASSWORD_CONCURRENCY'),
    passwordQueueLimit: boundedInt(env.CRA_PASSWORD_QUEUE_LIMIT, 256, 16, 5_000, 'CRA_PASSWORD_QUEUE_LIMIT'),
    seedDemoData,
    bootstrapAdmin: {
      username: env.CRA_ADMIN_USERNAME ?? 'admin',
      password: adminPassword,
      displayName: env.CRA_ADMIN_DISPLAY_NAME ?? '系统管理员',
    },
    logLevel: env.CRA_LOG_LEVEL ?? (bool(env.CRA_DEV, false) ? 'debug' : 'info'),
    smtp,
  };
}

export const config = loadConfig();
