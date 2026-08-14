/**
 * 报名服务：提交（事务 + 容量/唯一性校验）、查询、审核、分页列表、导出数据。
 */
import { randomBytes } from 'node:crypto';
import type { Db } from '../lib/db.ts';
import { toCamel } from '../lib/db.ts';
import { badRequest, conflict, notFound } from '../lib/errors.ts';
import { nowIso } from '../lib/time.ts';
import type { ApplicationRow, ApplicationStatus, RoundRow, SlotRow } from '../types.ts';
import { APPLICATION_STATUSES } from '../types.ts';
import { applyPhase, getActiveRound, getRound } from './roundService.ts';
import { getSlot } from './slotService.ts';
import { ensureInterview } from './interviewService.ts';

export interface CreateApplicationInput {
  roundId?: number;
  name: string;
  studentNumber: string;
  email: string;
  phone: string;
  slotId: number;
  answers: Record<string, string>;
}

export interface ApplicationDetail extends Omit<ApplicationRow, 'answers'> {
  answers: Record<string, string>;
  slot?: { id: number; startsAt: string; endsAt: string };
  reviewedByName?: string | null;
}

export function getApplication(db: Db, id: number): ApplicationDetail {
  const row = db
    .prepare(
      `SELECT a.*, u.display_name AS reviewed_by_name
       FROM applications a
       LEFT JOIN users u ON u.id = a.reviewed_by
       WHERE a.id = ?`,
    )
    .get(id) as
    | (ApplicationRow & { reviewed_by_name: string | null })
    | undefined;
  if (!row) throw notFound('报名记录不存在');
  return toDetail(db, row);
}

export function getApplicationByQueryCode(db: Db, queryCode: string): ApplicationDetail {
  const row = db
    .prepare(
      `SELECT a.*, u.display_name AS reviewed_by_name
       FROM applications a
       LEFT JOIN users u ON u.id = a.reviewed_by
       WHERE a.query_code = ?`,
    )
    .get(queryCode) as
    | (ApplicationRow & { reviewed_by_name: string | null })
    | undefined;
  if (!row) throw notFound('查询码不存在或已失效');
  return toDetail(db, row);
}

function toDetail(db: Db, row: ApplicationRow & { reviewed_by_name: string | null }): ApplicationDetail {
  const r = toCamel({ ...row }) as unknown as ApplicationRow & {
    reviewedByName: string | null;
  };
  let answers: Record<string, string> = {};
  try {
    const parsed = JSON.parse(r.answers) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      answers = parsed as Record<string, string>;
    }
  } catch {
    answers = {};
  }

  const detail: ApplicationDetail = {
    id: r.id,
    roundId: r.roundId,
    slotId: r.slotId,
    name: r.name,
    studentNumber: r.studentNumber,
    email: r.email,
    phone: r.phone,
    answers,
    queryCode: r.queryCode,
    status: r.status,
    reviewNote: r.reviewNote,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    reviewedByName: r.reviewedByName ?? null,
  };

  if (r.slotId !== null) {
    const slot = db.prepare('SELECT id, starts_at, ends_at FROM interview_slots WHERE id = ?').get(r.slotId) as
      | { id: number; starts_at: string; ends_at: string }
      | undefined;
    if (slot) detail.slot = { id: slot.id, startsAt: slot.starts_at, endsAt: slot.ends_at };
  }
  return detail;
}

/**
 * 提交报名。事务内完成：
 * - 轮次开放校验
 * - 时段存在、启用、未满校验
 * - 学号 / 邮箱 / 电话 在本轮次内唯一
 * - 写入并返回 query_code（用于候选人自助查询）
 */
export function createApplication(db: Db, input: CreateApplicationInput): ApplicationDetail {
  const round: RoundRow = input.roundId
    ? getRound(db, input.roundId)
    : getActiveRound(db);

  const phase = applyPhase(round);
  if (phase === 'not_started') throw conflict('报名尚未开始');
  if (phase === 'ended') throw conflict('报名已结束');

  const slot: SlotRow = getSlot(db, input.slotId);
  if (slot.roundId !== round.id) throw badRequest('所选面试时段不属于当前轮次');
  if (!slot.isEnabled) throw conflict('该面试时段已停止预约');

  const now = nowIso();
  const queryCode = randomBytes(16).toString('hex');

  // 唯一性预检（学号/邮箱/电话分别检查，给出精确的冲突提示）
  if (
    db
      .prepare('SELECT 1 FROM applications WHERE round_id = ? AND student_number = ?')
      .get(round.id, input.studentNumber)
  ) {
    throw conflict('该学号已在本轮次报名，请勿重复提交');
  }
  if (db.prepare('SELECT 1 FROM applications WHERE round_id = ? AND email = ?').get(round.id, input.email)) {
    throw conflict('该邮箱已在本轮次报名，请勿重复提交');
  }
  if (db.prepare('SELECT 1 FROM applications WHERE round_id = ? AND phone = ?').get(round.id, input.phone)) {
    throw conflict('该手机号已在本轮次报名，请勿重复提交');
  }

  const booked = (
    db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ?').get(slot.id) as { c: number }
  ).c;
  if (booked >= slot.capacity) throw conflict('该面试时段已约满，请选择其他时段');

  const result = db
    .prepare(
      `INSERT INTO applications
         (round_id, slot_id, name, student_number, email, phone, answers, query_code, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`,
    )
    .run(
      round.id,
      slot.id,
      input.name.trim(),
      input.studentNumber.trim(),
      input.email.trim().toLowerCase(),
      input.phone.trim(),
      JSON.stringify(input.answers),
      queryCode,
      now,
      now,
    );

  return getApplication(db, Number(result.lastInsertRowid));
}

/** 查询码是否可用（未使用） */
export function isQueryCodeAvailable(db: Db, queryCode: string): boolean {
  return (
    db.prepare('SELECT 1 FROM applications WHERE query_code = ?').get(queryCode) === undefined
  );
}

export interface ReviewInput {
  status: ApplicationStatus;
  note?: string;
}

/**
 * 删除报名记录（管理端）。硬删除 + 审计留痕：
 * 记录操作者与被删记录摘要，便于追溯误操作；删除后对应时段名额自动释放。
 */
export function deleteApplication(db: Db, id: number, actorId: number, actorName: string): void {
  const app = getApplication(db, id);
  const now = nowIso();

  db.prepare('DELETE FROM applications WHERE id = ?').run(id);
  db.prepare(
    `INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, 'delete', 'application', ?, ?, ?)`,
  ).run(
    actorId,
    actorName,
    id,
    JSON.stringify({
      deleted: {
        id: app.id,
        name: app.name,
        studentNumber: app.studentNumber,
        email: app.email,
        phone: app.phone,
        status: app.status,
        slotId: app.slotId,
        createdAt: app.createdAt,
      },
    }),
    now,
  );
}

export function reviewApplication(db: Db, id: number, reviewerId: number, reviewerName: string, input: ReviewInput): ApplicationDetail {
  if (!APPLICATION_STATUSES.includes(input.status)) {
    throw badRequest('无效的审核状态');
  }
  const app = getApplication(db, id);
  const now = nowIso();

  db.prepare(
    `UPDATE applications
     SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(input.status, input.note?.trim() || null, reviewerId, now, now, id);

  db.prepare(
    `INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, 'review', 'application', ?, ?, ?)`,
  ).run(
    reviewerId,
    reviewerName,
    id,
    JSON.stringify({ from: app.status, to: input.status, note: input.note ?? null }),
    now,
  );

  // 审核通过即进入面试环节：自动建立面试记录（幂等）
  if (input.status === 'approved' && app.status !== 'approved') {
    ensureInterview(db, id);
  }

  return getApplication(db, id);
}

/**
 * 调整候选人的面试时段（管理端统一安排）。
 * 校验新时段：属于同一轮次、启用、未满；写审计日志。
 */
export function rescheduleApplication(
  db: Db,
  id: number,
  actorId: number,
  actorName: string,
  newSlotId: number,
): ApplicationDetail {
  const app = getApplication(db, id);
  if (app.slotId === newSlotId) throw badRequest('新时段与当前时段相同');
  const slot: SlotRow = getSlot(db, newSlotId);
  if (slot.roundId !== app.roundId) throw badRequest('新面试时段不属于当前轮次');
  if (!slot.isEnabled) throw conflict('该面试时段已停止预约');

  const booked = (
    db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ?').get(newSlotId) as { c: number }
  ).c;
  if (booked >= slot.capacity) throw conflict('该面试时段已约满，请选择其他时段');

  const now = nowIso();
  db.prepare('UPDATE applications SET slot_id = ?, updated_at = ? WHERE id = ?').run(newSlotId, now, id);

  db.prepare(
    `INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, 'application_reschedule', 'application', ?, ?, ?)`,
  ).run(
    actorId,
    actorName,
    id,
    JSON.stringify({ fromSlotId: app.slotId, toSlotId: newSlotId }),
    now,
  );

  return getApplication(db, id);
}

export interface ListApplicationsQuery {
  status?: ApplicationStatus;
  keyword?: string;
  slotId?: number;
  roundId?: number;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface ListApplicationsResult {
  items: ApplicationDetail[];
  total: number;
  page: number;
  pageSize: number;
}

export function listApplications(db: Db, query: ListApplicationsQuery): ListApplicationsResult {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (query.roundId !== undefined) {
    conditions.push('a.round_id = ?');
    params.push(query.roundId);
  }
  if (query.status && APPLICATION_STATUSES.includes(query.status)) {
    conditions.push('a.status = ?');
    params.push(query.status);
  }
  if (query.slotId !== undefined) {
    conditions.push('a.slot_id = ?');
    params.push(query.slotId);
  }
  if (query.keyword?.trim()) {
    conditions.push('(a.name LIKE ? OR a.student_number LIKE ? OR a.email LIKE ? OR a.phone LIKE ?)');
    const kw = `%${query.keyword.trim()}%`;
    params.push(kw, kw, kw, kw);
  }
  if (query.from) {
    conditions.push('a.created_at >= ?');
    params.push(query.from);
  }
  if (query.to) {
    conditions.push('a.created_at <= ?');
    params.push(query.to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM applications a ${where}`).get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT a.*, u.display_name AS reviewed_by_name
       FROM applications a
       LEFT JOIN users u ON u.id = a.reviewed_by
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, query.pageSize, (query.page - 1) * query.pageSize) as unknown as Array<
      ApplicationRow & { reviewed_by_name: string | null }
    >;

  return {
    items: rows.map((r) => toDetail(db, r)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** 导出（不带分页，返回全量匹配行） */
export function listApplicationsForExport(db: Db, query: Omit<ListApplicationsQuery, 'page' | 'pageSize'>): ApplicationDetail[] {
  const result = listApplications(db, { ...query, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
  return result.items;
}

export function applicationCsvRows(apps: ApplicationDetail[]): unknown[][] {
  const questionKeys = Array.from(
    new Set(apps.flatMap((a) => Object.keys(a.answers))),
  );
  return apps.map((a) => [
    a.id,
    a.name,
    a.studentNumber,
    a.phone,
    a.email,
    a.slot ? `${formatSlot(a.slot.startsAt)} – ${formatSlot(a.slot.endsAt)}` : '未安排',
    a.status,
    ...questionKeys.map((k) => a.answers[k] ?? ''),
    a.reviewNote ?? '',
    a.createdAt,
  ]);
}

export function applicationCsvHeaders(apps: ApplicationDetail[]): string[] {
  const questionKeys = Array.from(
    new Set(apps.flatMap((a) => Object.keys(a.answers))),
  );
  return [
    'ID',
    '姓名',
    '学号',
    '电话',
    '邮箱',
    '面试时段',
    '状态',
    ...questionKeys.map((_, i) => `问题${i + 1}`),
    '审核备注',
    '报名时间(UTC)',
  ];
}

function formatSlot(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
