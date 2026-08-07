/**
 * 招募轮次服务：活动配置的读取。
 */
import type { Db } from '../lib/db.ts';
import { toCamel } from '../lib/db.ts';
import { notFound } from '../lib/errors.ts';
import type { RoundRow } from '../types.ts';

export function getRound(db: Db, id: number): RoundRow {
  const row = db.prepare('SELECT * FROM recruitment_rounds WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw notFound('招募轮次不存在');
  return toCamel(row) as unknown as RoundRow;
}

/** 当前唯一活动的轮次（取最新创建的） */
export function getActiveRound(db: Db): RoundRow {
  const row = db
    .prepare('SELECT * FROM recruitment_rounds WHERE is_open = 1 ORDER BY id DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;
  if (!row) throw notFound('当前没有开放的招募轮次，请联系管理员');
  return toCamel(row) as unknown as RoundRow;
}

export type ApplyPhase = 'not_started' | 'open' | 'ended';

export function applyPhase(round: RoundRow, now: Date = new Date()): ApplyPhase {
  if (!round.isOpen) return 'ended';
  const nowMs = now.getTime();
  const startMs = new Date(round.applyStartAt).getTime();
  const endMs = new Date(round.applyEndAt).getTime();
  if (nowMs < startMs) return 'not_started';
  if (nowMs > endMs) return 'ended';
  return 'open';
}
