import { randomBytes } from 'node:crypto';
import { hashPassword } from '../lib/password.ts';
import { writeAuditLog } from '../lib/audit.ts';
import type { Db } from '../lib/db.ts';
import { toCamel, withTransaction } from '../lib/db.ts';
import { badRequest, conflict, notFound, serviceUnavailable } from '../lib/errors.ts';
import { nowIso } from '../lib/time.ts';
import type { ApplicationRow, RoundRow, SlotRow } from '../types.ts';
import type { College } from '../types.ts';
import { applyPhase, getActiveRound, getRound } from './roundService.ts';
import { getSlot } from './slotService.ts';
import { consumeEmailChallenge } from './emailVerificationService.ts';

export interface CreateApplicationInput {
  roundId?: number;
  name: string;
  studentNumber: string;
  gender: 'male' | 'female';
  college: College;
  email: string;
  phone: string;
  password: string;
  slotId: number;
  answers: Record<string, string>;
  emailChallenge?: { id: string; targetDigest: string };
  canCommit?: () => boolean;
}

export interface UpdateCandidateApplicationInput {
  name: string;
  gender: 'male' | 'female';
  college: College;
  email: string;
  phone: string;
  slotId: number;
  answers: Record<string, string>;
  emailChallenge?: { id: string; targetDigest: string };
}

export interface ApplicationDetail extends Omit<
  ApplicationRow,
  'answers' | 'queryCode' | 'status' | 'reviewNote' | 'reviewedBy' | 'reviewedAt'
> {
  answers: Record<string, string>;
  slot?: { id: number; startsAt: string; endsAt: string };
}

export function getApplication(db: Db, id: number): ApplicationDetail {
  const row = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as ApplicationRow | undefined;
  if (!row) throw notFound('报名记录不存在');
  return toDetail(db, row);
}

function toDetail(db: Db, row: ApplicationRow): ApplicationDetail {
  const r = toCamel({ ...row }) as unknown as ApplicationRow;
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
    gender: r.gender,
    college: r.college,
    className: r.className,
    email: r.email,
    phone: r.phone,
    answers,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };

  if (r.slotId !== null) {
    const slot = db.prepare('SELECT id, starts_at, ends_at FROM interview_slots WHERE id = ?').get(r.slotId) as
      | { id: number; starts_at: string; ends_at: string }
      | undefined;
    if (slot) detail.slot = { id: slot.id, startsAt: slot.starts_at, endsAt: slot.ends_at };
  }
  return detail;
}

export async function createApplication(db: Db, input: CreateApplicationInput): Promise<ApplicationDetail> {
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
  const passwordHash = await hashPassword(input.password);
  if (input.canCommit && !input.canCommit()) {
    throw serviceUnavailable('请求已取消或处理超时，请重新提交');
  }

  return withTransaction(db, () => {
  const currentRound = getRound(db, round.id);
  const currentPhase = applyPhase(currentRound);
  if (currentPhase === 'not_started') throw conflict('报名尚未开始');
  if (currentPhase === 'ended') throw conflict('报名已结束');
  const currentSlot = getSlot(db, slot.id);
  if (currentSlot.roundId !== currentRound.id) throw badRequest('所选面试时段不属于当前轮次');
  if (!currentSlot.isEnabled) throw conflict('该面试时段已停止预约');

  const queryCode = randomBytes(16).toString('hex');

  if (
    db
      .prepare('SELECT 1 FROM applications WHERE round_id = ? AND student_number = ?')
      .get(round.id, input.studentNumber)
  ) {
    throw conflict('该报名信息已存在，请登录“我的报名”或联系协会负责人');
  }
  if (db.prepare('SELECT 1 FROM applications WHERE round_id = ? AND email = ?').get(round.id, input.email)) {
    throw conflict('该报名信息已存在，请登录“我的报名”或联系协会负责人');
  }
  if (db.prepare('SELECT 1 FROM applications WHERE round_id = ? AND phone = ?').get(round.id, input.phone)) {
    throw conflict('该报名信息已存在，请登录“我的报名”或联系协会负责人');
  }

  const booked = (
    db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ?').get(slot.id) as { c: number }
  ).c;
  if (booked >= currentSlot.capacity) throw conflict('该面试时段已约满，请选择其他时段');
  if (input.emailChallenge) {
    consumeEmailChallenge(db, input.emailChallenge, 'registration');
  }

  const result = db
    .prepare(
      `INSERT INTO applications
         (round_id, slot_id, name, student_number, gender, college,
          email, phone, password_hash, answers, query_code, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`,
    )
    .run(
      round.id,
      slot.id,
      input.name.trim(),
      input.studentNumber.trim(),
      input.gender,
      input.college.trim(),
      input.email.trim().toLowerCase(),
      input.phone.trim(),
      passwordHash,
      JSON.stringify(input.answers),
      queryCode,
      now,
      now,
    );

  return getApplication(db, Number(result.lastInsertRowid));
  });
}

export function updateCandidateApplication(
  db: Db,
  applicationId: number,
  input: UpdateCandidateApplicationInput,
): ApplicationDetail {
  return withTransaction(db, () => {
    const current = getApplication(db, applicationId);
    const round = getRound(db, current.roundId);
    if (applyPhase(round) !== 'open') throw conflict('报名已经结束，报名资料已锁定');
    const normalizedEmail = input.email.trim().toLowerCase();
    const emailChanged = normalizedEmail !== current.email.trim().toLowerCase();
    if (emailChanged && !input.emailChallenge) throw badRequest('修改邮箱前请验证新邮箱');

    const slot = getSlot(db, input.slotId);
    if (slot.roundId !== round.id) throw badRequest('所选面试时段不属于当前轮次');
    if (!slot.isEnabled) throw conflict('该面试时段已停止预约');

    const duplicateEmail = db
      .prepare('SELECT 1 FROM applications WHERE round_id = ? AND email = ? AND id <> ?')
      .get(round.id, normalizedEmail, applicationId);
    if (duplicateEmail) throw conflict('该邮箱已被其他报名使用');

    const duplicatePhone = db
      .prepare('SELECT 1 FROM applications WHERE round_id = ? AND phone = ? AND id <> ?')
      .get(round.id, input.phone, applicationId);
    if (duplicatePhone) throw conflict('该手机号已被其他报名使用');

    const bookedByOthers = (
      db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ? AND id <> ?').get(slot.id, applicationId) as { c: number }
    ).c;
    if (bookedByOthers >= slot.capacity) throw conflict('该面试时段已约满，请选择其他时段');
    if (emailChanged && input.emailChallenge) {
      consumeEmailChallenge(db, input.emailChallenge, 'registration');
    }

    const now = nowIso();
    db.prepare(
      `UPDATE applications
       SET slot_id = ?, name = ?, gender = ?, college = ?, email = ?, phone = ?, answers = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      slot.id,
      input.name,
      input.gender,
      input.college,
      normalizedEmail,
      input.phone,
      JSON.stringify(input.answers),
      now,
      applicationId,
    );

    writeAuditLog(db, {
      actorId: null,
      actorName: `候选人 ${current.studentNumber}`,
      action: 'candidate_application_update',
      entity: 'application',
      entityId: applicationId,
      detail: {
        changedFields: ['name', 'gender', 'college', 'email', 'phone', 'answers', 'slotId'],
        fromSlotId: current.slotId,
        toSlotId: slot.id,
      },
      createdAt: now,
    });

    return getApplication(db, applicationId);
  });
}

export function deleteApplication(db: Db, id: number, actorId: number, actorName: string): void {
  const app = getApplication(db, id);
  const now = nowIso();

  withTransaction(db, () => {
    db.prepare('DELETE FROM applications WHERE id = ?').run(id);
    writeAuditLog(db, {
      actorId,
      actorName,
      action: 'delete',
      entity: 'application',
      entityId: id,
      detail: {
      deleted: {
        id: app.id,
        redacted: true,
        slotId: app.slotId,
        createdAt: app.createdAt,
        },
      },
      createdAt: now,
    });
  });
}

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

  const now = nowIso();
  withTransaction(db, () => {
    const booked = (
      db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ?').get(newSlotId) as { c: number }
    ).c;
    if (booked >= slot.capacity) throw conflict('该面试时段已约满，请选择其他时段');

    db.prepare('UPDATE applications SET slot_id = ?, updated_at = ? WHERE id = ?').run(newSlotId, now, id);
    writeAuditLog(db, {
      actorId,
      actorName,
      action: 'application_reschedule',
      entity: 'application',
      entityId: id,
      detail: { fromSlotId: app.slotId, toSlotId: newSlotId },
      createdAt: now,
    });
  });

  return getApplication(db, id);
}

export interface ListApplicationsQuery {
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
  if (query.slotId !== undefined) {
    conditions.push('a.slot_id = ?');
    params.push(query.slotId);
  }
  if (query.keyword?.trim()) {
    conditions.push(
      '(a.name LIKE ? OR a.student_number LIKE ? OR a.email LIKE ? OR a.phone LIKE ? OR a.college LIKE ?)',
    );
    const kw = `%${query.keyword.trim()}%`;
    params.push(kw, kw, kw, kw, kw);
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
      `SELECT a.* FROM applications a ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, query.pageSize, (query.page - 1) * query.pageSize) as unknown as ApplicationRow[];

  return {
    items: rows.map((r) => toDetail(db, r)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export function listApplicationsForExport(db: Db, query: Omit<ListApplicationsQuery, 'page' | 'pageSize'>): ApplicationDetail[] {
  const exportLimit = 10_000;
  const result = listApplications(db, { ...query, page: 1, pageSize: exportLimit });
  if (result.total > exportLimit) {
    throw conflict(`单次最多导出 ${exportLimit} 条记录，请按轮次或条件筛选后分批导出`);
  }
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
    genderLabel(a.gender),
    a.college ?? '',
    a.phone,
    a.email,
    a.slot ? `${formatSlot(a.slot.startsAt)} – ${formatSlot(a.slot.endsAt)}` : '未安排',
    ...questionKeys.map((k) => a.answers[k] ?? ''),
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
    '性别',
    '学院',
    '电话',
    '邮箱',
    '报名时段',
    ...questionKeys.map((_, i) => `问题${i + 1}`),
    '报名时间(UTC)',
  ];
}

function genderLabel(gender: ApplicationDetail['gender']): string {
  if (gender === 'male') return '男';
  if (gender === 'female') return '女';
  if (gender === 'other') return '其他';
  return '';
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
