/**
 * 面试时段服务：查询（含剩余名额）、批量生成、修改、删除。
 */
import type { Db } from '../lib/db.ts';
import { toCamel } from '../lib/db.ts';
import { badRequest, conflict, notFound } from '../lib/errors.ts';
import { nowIso, slotKey, startOfLocalDay, TIMEZONE } from '../lib/time.ts';
import type { RoundRow, SlotRow } from '../types.ts';

export interface SlotWithBooked extends SlotRow {
  booked: number;
  remaining: number;
}

export function getSlot(db: Db, id: number): SlotRow {
  const row = db.prepare('SELECT * FROM interview_slots WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw notFound('面试时段不存在');
  return toCamel(row) as unknown as SlotRow;
}

export function listSlotsWithBooked(db: Db, roundId: number): SlotWithBooked[] {
  const rows = db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM applications a WHERE a.slot_id = s.id) AS booked
       FROM interview_slots s
       WHERE s.round_id = ?
       ORDER BY s.starts_at ASC`,
    )
    .all(roundId) as unknown as Array<Record<string, unknown>>;

  return rows.map((row) => {
    const camel = toCamel(row) as unknown as SlotRow & { booked: number };
    const booked = Number(camel.booked ?? 0);
    return {
      ...camel,
      booked,
      remaining: Math.max(0, camel.capacity - booked),
    };
  });
}

export interface GenerateSlotsInput {
  roundId: number;
  startDate: string; // yyyy-MM-dd（北京时间）
  endDate: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  capacity: number;
  excludeWeekends: boolean;
}

function parseTime(time: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) throw badRequest(`无效时间格式: ${time}，应为 HH:mm`);
  const hour = Number.parseInt(match[1] ?? '', 10);
  const minute = Number.parseInt(match[2] ?? '', 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw badRequest(`无效时间: ${time}`);
  }
  return { hour, minute };
}

function parseLocalDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw badRequest(`无效日期: ${date}，应为 yyyy-MM-dd`);
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

/**
 * 批量生成时段。按北京时间逐日生成，自动跳过与已有时段重叠的起始时刻。
 */
export function generateSlots(db: Db, input: GenerateSlotsInput): { created: number; skipped: number } {
  const startDate = parseLocalDate(input.startDate);
  const endDate = parseLocalDate(input.endDate);
  if (startDate.getTime() > endDate.getTime()) {
    throw badRequest('开始日期不能晚于结束日期');
  }
  if (input.durationMinutes < 5 || input.durationMinutes > 480) {
    throw badRequest('时段时长应在 5–480 分钟之间');
  }
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 100) {
    throw badRequest('时段容量应为 1–100 的整数');
  }

  const start = parseTime(input.startTime);
  const end = parseTime(input.endTime);
  const dayStartMinutes = start.hour * 60 + start.minute;
  const dayEndMinutes = end.hour * 60 + end.minute;
  if (dayEndMinutes <= dayStartMinutes) {
    throw badRequest('结束时间必须晚于开始时间');
  }

  const exists = db
    .prepare('SELECT 1 FROM interview_slots WHERE round_id = ? LIMIT 1')
    .get(input.roundId);
  if (!exists) {
    throw notFound('招募轮次不存在');
  }
  const existingStarts = new Set(
    (
      db
        .prepare('SELECT starts_at FROM interview_slots WHERE round_id = ?')
        .all(input.roundId) as Array<{ starts_at: string }>
    ).map((r) => r.starts_at),
  );

  const insert = db.prepare(
    `INSERT INTO interview_slots (round_id, starts_at, ends_at, capacity, is_enabled, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
  );

  let created = 0;
  let skipped = 0;
  const now = nowIso();
  const totalSlots = Math.floor((dayEndMinutes - dayStartMinutes) / input.durationMinutes);

  for (
    let day = new Date(startDate.getTime());
    day.getTime() <= endDate.getTime();
    day = new Date(day.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(day);
    if (input.excludeWeekends && (weekday === 'Sat' || weekday === 'Sun')) continue;

    for (let i = 0; i < totalSlots; i++) {
      const slotStart = new Date(day.getTime() + (dayStartMinutes + i * input.durationMinutes) * 60_000);
      const slotEnd = new Date(slotStart.getTime() + input.durationMinutes * 60_000);
      const startsAt = slotStart.toISOString();
      if (existingStarts.has(startsAt)) {
        skipped += 1;
        continue;
      }
      void slotKey(startsAt, slotEnd.toISOString());
      insert.run(input.roundId, startsAt, slotEnd.toISOString(), input.capacity, now);
      created += 1;
    }
  }

  return { created, skipped };
}

export function updateSlot(
  db: Db,
  id: number,
  patch: { capacity?: number; isEnabled?: boolean },
): SlotRow {
  const slot = getSlot(db, id);
  const capacity = patch.capacity ?? slot.capacity;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    throw badRequest('时段容量应为 1–100 的整数');
  }
  const booked = (
    db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ?').get(id) as { c: number }
  ).c;
  if (capacity < booked) {
    throw conflict(`容量不能小于已报名人数（${booked}）`);
  }

  db.prepare('UPDATE interview_slots SET capacity = ?, is_enabled = ? WHERE id = ?').run(
    capacity,
    patch.isEnabled === undefined ? slot.isEnabled : patch.isEnabled ? 1 : 0,
    id,
  );
  return getSlot(db, id);
}

export function deleteSlot(db: Db, id: number): void {
  const slot = getSlot(db, id);
  const booked = (
    db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ?').get(id) as { c: number }
  ).c;
  if (booked > 0) {
    throw conflict('该时段已有报名记录，不能删除');
  }
  db.prepare('DELETE FROM interview_slots WHERE id = ?').run(id);
  void slot;
}

export { startOfLocalDay };
