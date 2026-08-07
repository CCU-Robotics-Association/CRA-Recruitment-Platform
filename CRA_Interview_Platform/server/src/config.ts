/**
 * 环境配置。所有可调参数集中于此，通过环境变量覆盖，均有安全默认值。
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface AppConfig {
  /** 服务监听端口 */
  port: number;
  /** 服务监听地址 */
  host: string;
  /** 数据目录（SQLite 文件、自动生成的 JWT 密钥） */
  dataDir: string;
  /** 数据库文件路径 */
  dbPath: string;
  /** JWT 签名密钥 */
  jwtSecret: string;
  /** JWT 有效期（秒） */
  jwtExpiresInSeconds: number;
  /** 前端构建产物目录（可选，用于生产托管） */
  webDistDir: string | null;
  /** 管理端构建产物目录（可选，用于生产托管） */
  adminDistDir: string | null;
  /** 允许的跨域来源（开发模式下前端 dev server） */
  corsOrigins: string[];
  /** 默认管理员（首次启动种子时创建） */
  bootstrapAdmin: { username: string; password: string; displayName: string };
  /** 日志级别 */
  logLevel: string;
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

function resolveDataDir(): { dataDir: string; dbPath: string } {
  const base = process.env.CRA_DATA_DIR
    ? resolve(process.env.CRA_DATA_DIR)
    : resolve(process.cwd(), 'data');
  mkdirSync(base, { recursive: true });
  return { dataDir: base, dbPath: join(base, process.env.CRA_DB_FILE ?? 'cra.db') };
}

function resolveJwtSecret(dataDir: string): string {
  const fromEnv = process.env.CRA_JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  // 未显式配置时：生成随机密钥并持久化到数据目录，保证重启后令牌仍然有效。
  const secretFile = join(dataDir, '.jwt-secret');
  if (existsSync(secretFile)) {
    return readFileSync(secretFile, 'utf8').trim();
  }
  const generated = randomBytes(48).toString('base64url');
  writeFileSync(secretFile, generated, { encoding: 'utf8', mode: 0o600 });
  return generated;
}

function resolveCorsOrigins(): string[] {
  const raw = process.env.CRA_CORS_ORIGINS;
  if (!raw || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveWebDist(): string | null {
  const raw = process.env.CRA_WEB_DIST;
  if (raw === undefined) {
    // 默认：前端构建产物（保持与 vite.config.ts 的 outDir 一致）
    return resolve(process.cwd(), '..', 'dist', 'web');
  }
  if (raw === '') return null;
  return resolve(raw);
}

function resolveAdminDist(): string | null {
  const raw = process.env.CRA_ADMIN_DIST;
  if (raw === undefined) {
    return resolve(process.cwd(), '..', 'dist', 'admin');
  }
  if (raw === '') return null;
  return resolve(raw);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const { dataDir, dbPath } = resolveDataDir();

  return {
    port: int(env.CRA_PORT, 3000),
    host: env.CRA_HOST ?? '0.0.0.0',
    dataDir,
    dbPath,
    jwtSecret: resolveJwtSecret(dataDir),
    jwtExpiresInSeconds: int(env.CRA_JWT_EXPIRES_IN, 60 * 60 * 12),
    webDistDir: resolveWebDist(),
    adminDistDir: resolveAdminDist(),
    corsOrigins: resolveCorsOrigins(),
    bootstrapAdmin: {
      username: env.CRA_ADMIN_USERNAME ?? 'admin',
      password: env.CRA_ADMIN_PASSWORD ?? 'admin123456',
      displayName: env.CRA_ADMIN_DISPLAY_NAME ?? '系统管理员',
    },
    logLevel: env.CRA_LOG_LEVEL ?? (bool(env.CRA_DEV, false) ? 'debug' : 'info'),
  };
}

export const config = loadConfig();
