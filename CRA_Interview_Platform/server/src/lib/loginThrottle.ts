import { createHmac } from 'node:crypto';
import { config } from '../config.ts';
import type { Db } from './db.ts';
import { tooMany } from './errors.ts';

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
let lastPrunedAt = 0;

type FailureRow = {
  failure_count: number;
  window_started_at: string;
  blocked_until: string | null;
};

function identifierKey(scope: string, identifier: string): string {
  return createHmac('sha256', config.jwtSecret)
    .update(`${scope}\0${identifier.trim().toLowerCase()}`)
    .digest('base64url');
}

export function assertLoginAllowed(db: Db, scope: string, identifier: string): void {
  const key = identifierKey(scope, identifier);
  const row = db
    .prepare(
      'SELECT failure_count, window_started_at, blocked_until FROM auth_failures WHERE scope = ? AND identifier_key = ?',
    )
    .get(scope, key) as FailureRow | undefined;

  if (row?.blocked_until && Date.parse(row.blocked_until) > Date.now()) {
    throw tooMany('登录失败次数过多，请 15 分钟后重试');
  }

  if (row && Date.now() - Date.parse(row.window_started_at) >= WINDOW_MS) {
    db.prepare('DELETE FROM auth_failures WHERE scope = ? AND identifier_key = ?').run(scope, key);
  }
}

export function recordLoginFailure(db: Db, scope: string, identifier: string): void {
  const key = identifierKey(scope, identifier);
  const nowMs = Date.now();
  if (nowMs - lastPrunedAt >= PRUNE_INTERVAL_MS) {
    pruneLoginFailures(db);
    lastPrunedAt = nowMs;
  }
  const now = new Date(nowMs).toISOString();
  const row = db
    .prepare(
      'SELECT failure_count, window_started_at, blocked_until FROM auth_failures WHERE scope = ? AND identifier_key = ?',
    )
    .get(scope, key) as FailureRow | undefined;

  const withinWindow = row && nowMs - Date.parse(row.window_started_at) < WINDOW_MS;
  const failureCount = withinWindow ? row.failure_count + 1 : 1;
  const windowStartedAt = withinWindow ? row.window_started_at : now;
  const blockedUntil =
    failureCount >= MAX_FAILURES ? new Date(nowMs + BLOCK_MS).toISOString() : null;

  db.prepare(
    `INSERT INTO auth_failures
       (scope, identifier_key, failure_count, window_started_at, blocked_until, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(scope, identifier_key) DO UPDATE SET
       failure_count = excluded.failure_count,
       window_started_at = excluded.window_started_at,
       blocked_until = excluded.blocked_until,
       updated_at = excluded.updated_at`,
  ).run(scope, key, failureCount, windowStartedAt, blockedUntil, now);
}

export function clearLoginFailures(db: Db, scope: string, identifier: string): void {
  db.prepare('DELETE FROM auth_failures WHERE scope = ? AND identifier_key = ?').run(
    scope,
    identifierKey(scope, identifier),
  );
}

/** 清理已经失效的登录失败记录，避免恶意随机账号令表无限增长。 */
export function pruneLoginFailures(db: Db, retentionMs = 48 * 60 * 60 * 1000): number {
  const cutoff = new Date(Date.now() - retentionMs).toISOString();
  const result = db.prepare('DELETE FROM auth_failures WHERE updated_at < ?').run(cutoff);
  return Number(result.changes);
}
