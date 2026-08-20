import type { Db } from '../lib/db.ts';
import { toCamel, withTransaction } from '../lib/db.ts';
import { conflict, notFound } from '../lib/errors.ts';
import { nowIso } from '../lib/time.ts';
import { writeAuditLog } from '../lib/audit.ts';
import type { RoundRow } from '../types.ts';

export function getRound(db: Db, id: number): RoundRow {
  const row = db.prepare('SELECT * FROM recruitment_rounds WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw notFound('招募轮次不存在');
  return toCamel(row) as unknown as RoundRow;
}

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

export function deleteRound(db: Db, id: number, actorId: number, actorName: string): void {
  const round = getRound(db, id);
  const appCount = (
    db.prepare('SELECT COUNT(*) AS c FROM applications WHERE round_id = ?').get(id) as { c: number }
  ).c;
  if (appCount > 0) {
    throw conflict(`该轮次已有 ${appCount} 条报名记录，不能删除；请先处理相关报名`);
  }
  const slotCount = (
    db.prepare('SELECT COUNT(*) AS c FROM interview_slots WHERE round_id = ?').get(id) as { c: number }
  ).c;

  withTransaction(db, () => {
    db.prepare('DELETE FROM recruitment_rounds WHERE id = ?').run(id);
    writeAuditLog(db, {
      actorId,
      actorName,
      action: 'round_delete',
      entity: 'recruitment_round',
      entityId: id,
      detail: { deleted: { id: round.id, title: round.title, slotCount } },
      createdAt: nowIso(),
    });
  });
}
