/**
 * 种子数据（幂等）：
 * 1. 默认管理员（仅当 users 表为空时创建）
 * 2. 默认招募轮次 + 匹配前端硬编码页面的默认面试时段
 */
import type { Db } from '../lib/db.ts';
import { config } from '../config.ts';
import { hashPassword } from '../lib/password.ts';
import { nowIso, startOfLocalDay } from '../lib/time.ts';

export interface SeedResult {
  adminCreated: boolean;
  roundCreated: boolean;
  slotsCreated: number;
}

/**
 * 生成某天 09:00（北京时间）起、每 durationMinutes 一个、共 count 个时段（匹配前端报名页）。
 * 使用 Asia/Shanghai 显式计算，不依赖服务器本地时区。
 */
export function buildDefaultSlots(day: Date, durationMinutes: number, count: number) {
  const dayStartMs = startOfLocalDay(day).getTime();
  const startMs = dayStartMs + 9 * 60 * 60 * 1000; // 北京时间 09:00
  return Array.from({ length: count }, (_, i) => {
    const s = startMs + i * durationMinutes * 60_000;
    const e = s + durationMinutes * 60_000;
    return { startsAt: new Date(s).toISOString(), endsAt: new Date(e).toISOString() };
  });
}

export function seed(db: Db): SeedResult {
  const result: SeedResult = { adminCreated: false, roundCreated: false, slotsCreated: 0 };

  // 1. 默认管理员
  const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    const { username, password, displayName } = config.bootstrapAdmin;
    const now = nowIso();
    db.prepare(
      `INSERT INTO users (username, password_hash, display_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 'super_admin', 1, ?, ?)`,
    ).run(username, hashPassword(password), displayName, now, now);
    result.adminCreated = true;
  }

  // 2. 默认轮次（仅当没有轮次时）
  const roundCount = (db.prepare('SELECT COUNT(*) AS c FROM recruitment_rounds').get() as { c: number }).c;
  if (roundCount === 0) {
    const now = nowIso();
    const interviewDay = new Date(Date.UTC(2026, 8, 9, 16, 0, 0)); // 2026-09-10 00:00 +08:00
    const applyEnd = new Date(interviewDay.getTime() - 24 * 60 * 60 * 1000 - 1); // 2026-09-09 23:59:59 +08:00
    const roundEnd = new Date(interviewDay.getTime() + 4 * 60 * 60 * 1000); // 12:00 +08:00

    const info = db
      .prepare(
        `INSERT INTO recruitment_rounds
           (title, description, apply_start_at, apply_end_at, interview_start_at, interview_end_at, is_open, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
        '2026 年秋季招新',
        'CRA 机器人协会 2026 年秋季招新报名与面试',
        now,
        applyEnd.toISOString(),
        interviewDay.toISOString(),
        roundEnd.toISOString(),
        now,
        now,
      );
    result.roundCreated = true;

    const roundId = Number(info.lastInsertRowid);
    const slots = buildDefaultSlots(interviewDay, 15, 12);
    const insertSlot = db.prepare(
      'INSERT INTO interview_slots (round_id, starts_at, ends_at, capacity, is_enabled, created_at) VALUES (?, ?, ?, 1, 1, ?)',
    );
    for (const slot of slots) {
      insertSlot.run(roundId, slot.startsAt, slot.endsAt, now);
      result.slotsCreated += 1;
    }
  }

  return result;
}
