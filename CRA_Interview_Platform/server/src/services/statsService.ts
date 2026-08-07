/**
 * 统计服务：仪表盘概览数据。
 */
import type { Db } from '../lib/db.ts';
import { endOfLocalDay, nowIso, startOfLocalDay, TIMEZONE } from '../lib/time.ts';
import type { ApplicationStatus } from '../types.ts';
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES } from '../types.ts';

export interface StatsOverview {
  total: number;
  byStatus: Array<{ status: ApplicationStatus; label: string; count: number }>;
  todayNew: number;
  todayNewAt: string;
  slotOccupancy: Array<{
    slotId: number;
    startsAt: string;
    endsAt: string;
    capacity: number;
    booked: number;
    remaining: number;
  }>;
  recent: Array<{
    id: number;
    name: string;
    studentNumber: string;
    status: ApplicationStatus;
    createdAt: string;
  }>;
}

export function getOverview(db: Db): StatsOverview {
  const total = (db.prepare('SELECT COUNT(*) AS c FROM applications').get() as { c: number }).c;

  const statusRows = db
    .prepare('SELECT status, COUNT(*) AS c FROM applications GROUP BY status')
    .all() as Array<{ status: ApplicationStatus; c: number }>;
  const byStatusMap = new Map(statusRows.map((r) => [r.status, r.c]));
  const byStatus = APPLICATION_STATUSES.map((status) => ({
    status,
    label: APPLICATION_STATUS_LABELS[status],
    count: byStatusMap.get(status) ?? 0,
  }));

  const now = new Date();
  const todayStart = startOfLocalDay(now).toISOString();
  const todayEnd = endOfLocalDay(now).toISOString();
  const todayNew = (
    db
      .prepare('SELECT COUNT(*) AS c FROM applications WHERE created_at >= ? AND created_at <= ?')
      .get(todayStart, todayEnd) as { c: number }
  ).c;

  const slots = db
    .prepare(
      `SELECT s.id, s.starts_at, s.ends_at, s.capacity,
              (SELECT COUNT(*) FROM applications a WHERE a.slot_id = s.id) AS booked
       FROM interview_slots s
       ORDER BY s.starts_at ASC
       LIMIT 50`,
    )
    .all() as Array<{
    id: number;
    starts_at: string;
    ends_at: string;
    capacity: number;
    booked: number;
  }>;

  const slotOccupancy = slots.map((s) => ({
    slotId: s.id,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    capacity: s.capacity,
    booked: s.booked,
    remaining: Math.max(0, s.capacity - s.booked),
  }));

  const recent = db
    .prepare(
      'SELECT id, name, student_number, status, created_at FROM applications ORDER BY created_at DESC, id DESC LIMIT 8',
    )
    .all() as Array<{
    id: number;
    name: string;
    student_number: string;
    status: ApplicationStatus;
    created_at: string;
  }>;

  return {
    total,
    byStatus,
    todayNew,
    todayNewAt: nowIso(),
    slotOccupancy,
    recent: recent.map((r) => ({
      id: r.id,
      name: r.name,
      studentNumber: r.student_number,
      status: r.status,
      createdAt: r.created_at,
    })),
  };
}

export { TIMEZONE };
