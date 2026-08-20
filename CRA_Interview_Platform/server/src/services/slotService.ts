import type { Db } from '../lib/db.ts';
import { toCamel, withTransaction } from '../lib/db.ts';
import { badRequest, conflict, notFound } from '../lib/errors.ts';
import { nowIso, slotKey, startOfLocalDay, TIMEZONE } from '../lib/time.ts';
import { writeAuditLog } from '../lib/audit.ts';
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

export interface ShiftRoundSlotsResult {
  shifted: number;
  deltaMinutes: number;
  firstStartsAt: string;
  lastEndsAt: string;
}

export function shiftRoundSlots(
  db: Db,
  roundId: number,
  firstSlotStartsAt: string,
  actorId: number,
  actorName: string,
): ShiftRoundSlotsResult {
  const targetFirstMs = Date.parse(firstSlotStartsAt);
  if (!Number.isFinite(targetFirstMs)) throw badRequest('新的首个时段时间格式无效');

  const roundExists = db.prepare('SELECT 1 FROM recruitment_rounds WHERE id = ?').get(roundId);
  if (!roundExists) throw notFound('招募轮次不存在');

  const slots = db
    .prepare(
      `SELECT id, starts_at, ends_at
       FROM interview_slots
       WHERE round_id = ?
       ORDER BY starts_at ASC, id ASC`,
    )
    .all(roundId) as Array<{ id: number; starts_at: string; ends_at: string }>;
  if (slots.length === 0) throw conflict('当前轮次还没有可调整的报名时段');

  const firstSlot = slots[0];
  if (!firstSlot) throw conflict('当前轮次还没有可调整的报名时段');
  const currentFirstMs = Date.parse(firstSlot.starts_at);
  if (!Number.isFinite(currentFirstMs)) throw conflict('当前时段数据异常，无法整体调整');
  const deltaMs = targetFirstMs - currentFirstMs;
  if (deltaMs === 0) throw badRequest('新的首个时段时间与当前时间相同');

  const shiftedSlots = slots.map((slot) => {
    const startMs = Date.parse(slot.starts_at);
    const endMs = Date.parse(slot.ends_at);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      throw conflict(`时段 #${slot.id} 的日期时间异常，无法整体调整`);
    }
    const newStart = new Date(startMs + deltaMs);
    const newEnd = new Date(endMs + deltaMs);
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      throw badRequest('调整后的日期超出有效范围');
    }
    return {
      id: slot.id,
      startsAt: newStart.toISOString(),
      endsAt: newEnd.toISOString(),
    };
  });

  const firstStartsAt = shiftedSlots[0]?.startsAt;
  const lastEndsAt = shiftedSlots.at(-1)?.endsAt;
  if (!firstStartsAt || !lastEndsAt) throw conflict('当前轮次还没有可调整的报名时段');

  const now = nowIso();
  withTransaction(db, () => {
    const moveToTemporary = db.prepare('UPDATE interview_slots SET starts_at = ?, ends_at = ? WHERE id = ?');
    for (const slot of shiftedSlots) {
      moveToTemporary.run(`__slot_shift_${roundId}_${slot.id}_${now}`, slot.endsAt, slot.id);
    }

    const moveToFinal = db.prepare('UPDATE interview_slots SET starts_at = ?, ends_at = ? WHERE id = ?');
    for (const slot of shiftedSlots) {
      moveToFinal.run(slot.startsAt, slot.endsAt, slot.id);
    }

    db.prepare(
      `UPDATE recruitment_rounds
       SET interview_start_at = ?, interview_end_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(firstStartsAt, lastEndsAt, now, roundId);

    writeAuditLog(db, {
      actorId,
      actorName,
      action: 'slots_shift',
      entity: 'recruitment_round',
      entityId: roundId,
      detail: {
        shifted: shiftedSlots.length,
        deltaMinutes: deltaMs / 60_000,
        fromFirstStartsAt: firstSlot.starts_at,
        toFirstStartsAt: firstStartsAt,
        toLastEndsAt: lastEndsAt,
      },
      createdAt: now,
    });
  });

  return {
    shifted: shiftedSlots.length,
    deltaMinutes: deltaMs / 60_000,
    firstStartsAt,
    lastEndsAt,
  };
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
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw badRequest(`无效日历日期: ${date}`);
  }
  return parsed;
}

export function generateSlots(
  db: Db,
  input: GenerateSlotsInput,
  actorId: number,
  actorName: string,
): { created: number; skipped: number } {
  const startDate = parseLocalDate(input.startDate);
  const endDate = parseLocalDate(input.endDate);
  if (startDate.getTime() > endDate.getTime()) {
    throw badRequest('开始日期不能晚于结束日期');
  }
  const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (dayCount > 366) throw badRequest('单次生成的日期跨度不能超过 366 天');
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
    .prepare('SELECT 1 FROM recruitment_rounds WHERE id = ?')
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
  if (dayCount * totalSlots > 2_000) {
    throw badRequest('单次最多生成 2000 个候选时段，请缩小日期范围或增大时段间隔');
  }

  const dayStartMs = startOfLocalDay(startDate).getTime();
  const dayEndMs = startOfLocalDay(endDate).getTime();

  withTransaction(db, () => {
    for (let dayMs = dayStartMs; dayMs <= dayEndMs; dayMs += 24 * 60 * 60 * 1000) {
      const day = new Date(dayMs);
      const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(day);
      if (input.excludeWeekends && (weekday === 'Sat' || weekday === 'Sun')) continue;

      for (let i = 0; i < totalSlots; i++) {
        const slotStartMs = dayMs + (dayStartMinutes + i * input.durationMinutes) * 60_000;
        const slotEndMs = slotStartMs + input.durationMinutes * 60_000;
        const startsAt = new Date(slotStartMs).toISOString();
        if (existingStarts.has(startsAt)) {
          skipped += 1;
          continue;
        }
        void slotKey(startsAt, new Date(slotEndMs).toISOString());
        insert.run(input.roundId, startsAt, new Date(slotEndMs).toISOString(), input.capacity, now);
        created += 1;
      }
    }
    writeAuditLog(db, {
      actorId,
      actorName,
      action: 'slots_generate',
      entity: 'recruitment_round',
      entityId: input.roundId,
      detail: { ...input, created, skipped },
      createdAt: now,
    });
  });

  return { created, skipped };
}

export function updateSlot(
  db: Db,
  id: number,
  patch: { capacity?: number; isEnabled?: boolean },
  actorId: number,
  actorName: string,
): SlotRow {
  const slot = getSlot(db, id);
  const capacity = patch.capacity ?? slot.capacity;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    throw badRequest('时段容量应为 1–100 的整数');
  }
  return withTransaction(db, () => {
    const booked = (
      db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ?').get(id) as { c: number }
    ).c;
    if (capacity < booked) throw conflict(`容量不能小于已报名人数（${booked}）`);
    const isEnabled = patch.isEnabled === undefined ? slot.isEnabled : patch.isEnabled;
    db.prepare('UPDATE interview_slots SET capacity = ?, is_enabled = ? WHERE id = ?').run(
      capacity,
      isEnabled ? 1 : 0,
      id,
    );
    writeAuditLog(db, {
      actorId,
      actorName,
      action: 'slot_update',
      entity: 'interview_slot',
      entityId: id,
      detail: {
        from: { capacity: slot.capacity, isEnabled: slot.isEnabled },
        to: { capacity, isEnabled },
      },
    });
    return getSlot(db, id);
  });
}

export function deleteSlot(db: Db, id: number, actorId: number, actorName: string): void {
  const slot = getSlot(db, id);
  const booked = (
    db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ?').get(id) as { c: number }
  ).c;
  if (booked > 0) {
    throw conflict('该时段已有报名记录，不能删除');
  }
  withTransaction(db, () => {
    db.prepare('DELETE FROM interview_slots WHERE id = ?').run(id);
    writeAuditLog(db, {
      actorId,
      actorName,
      action: 'slot_delete',
      entity: 'interview_slot',
      entityId: id,
      detail: { deleted: slot },
    });
  });
}

export function deleteSlotsBatch(
  db: Db,
  ids: number[],
  actorId: number,
  actorName: string,
): { deleted: number; failed: Array<{ id: number; reason: string }> } {
  const failed: Array<{ id: number; reason: string }> = [];
  const deletedIds: number[] = [];
  let deleted = 0;

  withTransaction(db, () => {
    for (const id of ids) {
      const row = db.prepare('SELECT id FROM interview_slots WHERE id = ?').get(id);
      if (!row) {
        failed.push({ id, reason: '时段不存在' });
        continue;
      }
      const booked = (
        db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ?').get(id) as { c: number }
      ).c;
      if (booked > 0) {
        failed.push({ id, reason: `已有 ${booked} 条报名，不能删除` });
        continue;
      }
      db.prepare('DELETE FROM interview_slots WHERE id = ?').run(id);
      deleted += 1;
      deletedIds.push(id);
    }
    writeAuditLog(db, {
      actorId,
      actorName,
      action: 'slots_batch_delete',
      entity: 'interview_slot',
      detail: { requestedIds: ids, deletedIds, failed },
    });
  });

  return { deleted, failed };
}

export { startOfLocalDay };
