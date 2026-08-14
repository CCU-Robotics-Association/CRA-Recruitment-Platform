/**
 * 面试服务：面试记录管理（管理端统一控制候选人的面试情况）。
 * - 审核通过（approved）时自动建立面试记录（status=pending，懒创建兜底）
 * - 状态流转 / 评分评语 / 结果发布，全部写入审计日志
 * - 面试时段沿用 applications.slot_id，由管理端调整（rescheduleApplication）
 * - 修改任何面试内容后自动撤回已发布结果，保证候选人看到的始终是管理端确认的最新结果
 */
import type { Db } from '../lib/db.ts';
import { badRequest, conflict, notFound } from '../lib/errors.ts';
import { nowIso } from '../lib/time.ts';
import type { ApplicationStatus, InterviewRow, InterviewStatus } from '../types.ts';
import { INTERVIEW_STATUSES } from '../types.ts';

export interface InterviewDetail {
  id: number;
  applicationId: number;
  status: InterviewStatus;
  score: number | null;
  comment: string | null;
  resultPublished: boolean;
  resultPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  application: {
    id: number;
    roundId: number;
    roundTitle: string;
    name: string;
    studentNumber: string;
    email: string;
    phone: string;
    applicationStatus: ApplicationStatus;
    appliedAt: string;
    slot: { id: number; startsAt: string; endsAt: string } | null;
  };
}

export interface InterviewListItem {
  applicationId: number;
  roundId: number;
  roundTitle: string;
  name: string;
  studentNumber: string;
  phone: string;
  email: string;
  appliedAt: string;
  slot: { id: number; startsAt: string; endsAt: string } | null;
  interview: {
    id: number | null;
    status: InterviewStatus;
    score: number | null;
    comment: string | null;
    resultPublished: boolean;
    resultPublishedAt: string | null;
    updatedAt: string | null;
  };
}

export interface ListInterviewsQuery {
  roundId?: number;
  status?: InterviewStatus;
  keyword?: string;
  page: number;
  pageSize: number;
}

export interface ListInterviewsResult {
  items: InterviewListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 幂等创建面试记录（审核通过时调用；其它面试操作兜底调用） */
export function ensureInterview(db: Db, applicationId: number): InterviewRow {
  const exists = db.prepare('SELECT id FROM applications WHERE id = ?').get(applicationId);
  if (!exists) throw notFound('报名记录不存在');
  const now = nowIso();
  db.prepare(
    `INSERT INTO interviews (application_id, status, created_at, updated_at)
     VALUES (?, 'pending', ?, ?)
     ON CONFLICT(application_id) DO NOTHING`,
  ).run(applicationId, now, now);
  const row = db
    .prepare('SELECT * FROM interviews WHERE application_id = ?')
    .get(applicationId) as unknown as Record<string, unknown> | undefined;
  if (!row) throw new Error('面试记录创建失败');
  return mapRow(row);
}

export function getInterviewByApplication(db: Db, applicationId: number): InterviewRow | null {
  const row = db.prepare('SELECT * FROM interviews WHERE application_id = ?').get(applicationId) as
    | Record<string, unknown>
    | undefined;
  return row ? mapRow(row) : null;
}

export function getInterview(db: Db, id: number): InterviewDetail {
  const row = db
    .prepare(
      `SELECT i.*,
              a.round_id, a.slot_id, a.name, a.student_number, a.email, a.phone,
              a.status AS application_status, a.created_at AS applied_at,
              r.title AS round_title,
              s.starts_at AS slot_starts_at, s.ends_at AS slot_ends_at
       FROM interviews i
       JOIN applications a ON a.id = i.application_id
       JOIN recruitment_rounds r ON r.id = a.round_id
       LEFT JOIN interview_slots s ON s.id = a.slot_id
       WHERE i.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) throw notFound('面试记录不存在');
  return toDetail(row);
}

export interface UpdateInterviewInput {
  status?: InterviewStatus;
  score?: number | null;
  comment?: string | null;
}

/**
 * 更新面试记录（状态流转 / 评分 / 评语），可一次提交多项。
 * 成功后自动撤回已发布结果（管理端需重新发布才会对候选人可见）。
 */
export function updateInterview(
  db: Db,
  id: number,
  actorId: number,
  actorName: string,
  input: UpdateInterviewInput,
): InterviewDetail {
  const existing = getInterview(db, id);
  const now = nowIso();
  const changes: string[] = [];
  const params: Array<string | number | null> = [];

  if (input.status !== undefined) {
    if (!INTERVIEW_STATUSES.includes(input.status)) throw badRequest('无效的面试状态');
    if (input.status !== existing.status) {
      changes.push('status');
      db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, detail, created_at)
         VALUES (?, ?, 'interview_status', 'interview', ?, ?, ?)`,
      ).run(
        actorId,
        actorName,
        id,
        JSON.stringify({ from: existing.status, to: input.status }),
        now,
      );
    }
  }
  if (input.score !== undefined) {
    if (input.score !== null && (!Number.isInteger(input.score) || input.score < 0 || input.score > 100)) {
      throw badRequest('评分应为 0–100 的整数');
    }
    if (input.score !== existing.score) changes.push('score');
  }
  if (input.comment !== undefined) {
    const comment = input.comment?.trim() || null;
    if (comment && comment.length > 2000) throw badRequest('评语过长（最多 2000 字）');
    if (comment !== existing.comment) changes.push('comment');
  }

  if (changes.length === 0) return existing;

  const status = input.status ?? existing.status;
  const score = input.score !== undefined ? input.score : existing.score;
  const comment = input.comment !== undefined ? input.comment?.trim() || null : existing.comment;

  // 自动发布策略：面试结论为终态（通过/不通过/候补）时保存即对候选人可见；
  // 非终态（待面试/已面试/未到场）不发布，若此前已发布则自动撤回（重新评估中）。
  const isFinal = status === 'passed' || status === 'failed' || status === 'waitlisted';
  const wasPublished = existing.resultPublishedAt !== null;
  const newPublishedAt = isFinal ? now : null;
  const visibilityChanged = wasPublished !== (newPublishedAt !== null);

  db.prepare(
    `UPDATE interviews
     SET status = ?, score = ?, comment = ?, result_published_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(status, score, comment, newPublishedAt, now, id);

  if (changes.includes('score') || changes.includes('comment')) {
    db.prepare(
      `INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, detail, created_at)
       VALUES (?, ?, 'interview_score', 'interview', ?, ?, ?)`,
    ).run(
      actorId,
      actorName,
      id,
      JSON.stringify({ score, comment, previousScore: existing.score, previousComment: existing.comment }),
      now,
    );
  }

  if (visibilityChanged) {
    if (newPublishedAt !== null) {
      db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, detail, created_at)
         VALUES (?, ?, 'interview_publish', 'interview', ?, ?, ?)`,
      ).run(actorId, actorName, id, JSON.stringify({ auto: true, status }), now);
    } else {
      db.prepare(
        `INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, detail, created_at)
         VALUES (?, ?, 'interview_unpublish', 'interview', ?, ?, ?)`,
      ).run(actorId, actorName, id, JSON.stringify({ auto: true, reason: 'status_not_final' }), now);
    }
  }

  return getInterview(db, id);
}

/** 发布面试结果（手动端点，兜底）：仅面试结论为终态时可发布 */
export function publishInterviewResult(db: Db, id: number, actorId: number, actorName: string): InterviewDetail {
  const existing = getInterview(db, id);
  if (existing.status !== 'passed' && existing.status !== 'failed' && existing.status !== 'waitlisted') {
    throw conflict('仅当面试结论为通过/不通过/候补时才能发布结果');
  }
  if (existing.resultPublishedAt !== null) {
    throw conflict('面试结果已发布，请勿重复发布');
  }
  const now = nowIso();
  db.prepare('UPDATE interviews SET result_published_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);
  db.prepare(
    `INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, 'interview_publish', 'interview', ?, ?, ?)`,
  ).run(actorId, actorName, id, JSON.stringify({ status: existing.status, score: existing.score }), now);
  return getInterview(db, id);
}

/** 撤回已发布的结果（重新评估或误发布时使用） */
export function unpublishInterviewResult(db: Db, id: number, actorId: number, actorName: string): InterviewDetail {
  const existing = getInterview(db, id);
  if (existing.resultPublishedAt === null) {
    throw conflict('面试结果尚未发布');
  }
  db.prepare('UPDATE interviews SET result_published_at = NULL, updated_at = ? WHERE id = ?').run(nowIso(), id);
  db.prepare(
    `INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, 'interview_unpublish', 'interview', ?, ?, ?)`,
  ).run(actorId, actorName, id, JSON.stringify({ reason: 'manual' }), nowIso());
  return getInterview(db, id);
}

/** 面试列表：展示所有已通过审核（approved）的候选人及其面试记录 */
export function listInterviews(db: Db, query: ListInterviewsQuery): ListInterviewsResult {
  const conditions: string[] = ["a.status = 'approved'"];
  const params: Array<string | number> = [];

  if (query.roundId !== undefined) {
    conditions.push('a.round_id = ?');
    params.push(query.roundId);
  }
  if (query.status && INTERVIEW_STATUSES.includes(query.status)) {
    if (query.status === 'pending') {
      conditions.push('(i.status IS NULL OR i.status = ?)');
    } else {
      conditions.push('i.status = ?');
    }
    params.push(query.status);
  }
  if (query.keyword?.trim()) {
    conditions.push('(a.name LIKE ? OR a.student_number LIKE ? OR a.email LIKE ? OR a.phone LIKE ?)');
    const kw = `%${query.keyword.trim()}%`;
    params.push(kw, kw, kw, kw);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM applications a LEFT JOIN interviews i ON i.application_id = a.id ${where}`).get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT a.id AS application_id, a.round_id, a.name, a.student_number, a.email, a.phone,
              a.status AS application_status, a.created_at AS applied_at,
              r.title AS round_title,
              s.starts_at AS slot_starts_at, s.ends_at AS slot_ends_at,
              i.id AS interview_id, i.status AS interview_status, i.score, i.comment,
              i.result_published_at, i.updated_at AS interview_updated_at
       FROM applications a
       JOIN recruitment_rounds r ON r.id = a.round_id
       LEFT JOIN interview_slots s ON s.id = a.slot_id
       LEFT JOIN interviews i ON i.application_id = a.id
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, query.pageSize, (query.page - 1) * query.pageSize) as unknown as Array<Record<string, unknown>>;

  return {
    items: rows.map(toListItem),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

function mapRow(row: Record<string, unknown>): InterviewRow {
  return {
    id: Number(row.id),
    applicationId: Number(row.application_id),
    status: row.status as InterviewStatus,
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    comment: (row.comment as string | null) ?? null,
    resultPublishedAt: (row.result_published_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toDetail(row: Record<string, unknown>): InterviewDetail {
  const status = ((row.interview_status ?? row.status) as InterviewStatus | null) ?? 'pending';
  const resultPublishedAt = (row.result_published_at as string | null) ?? null;
  const slot =
    row.slot_starts_at !== null && row.slot_starts_at !== undefined
      ? { id: Number(row.slot_id), startsAt: row.slot_starts_at as string, endsAt: row.slot_ends_at as string }
      : null;

  return {
    id: Number(row.id),
    applicationId: Number(row.application_id),
    status,
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    comment: (row.comment as string | null) ?? null,
    resultPublished: resultPublishedAt !== null,
    resultPublishedAt,
    createdAt: row.created_at as string,
    updatedAt: (row.interview_updated_at as string | null) ?? (row.updated_at as string),
    application: {
      id: Number(row.application_id),
      roundId: Number(row.round_id),
      roundTitle: row.round_title as string,
      name: row.name as string,
      studentNumber: row.student_number as string,
      email: row.email as string,
      phone: row.phone as string,
      applicationStatus: row.application_status as ApplicationStatus,
      appliedAt: row.applied_at as string,
      slot,
    },
  };
}

function toListItem(row: Record<string, unknown>): InterviewListItem {
  const interviewId = row.interview_id === null || row.interview_id === undefined ? null : Number(row.interview_id);
  const status = ((row.interview_status as InterviewStatus | null) ?? 'pending') as InterviewStatus;
  const resultPublishedAt = (row.result_published_at as string | null) ?? null;
  const slot =
    row.slot_starts_at !== null && row.slot_starts_at !== undefined
      ? { id: Number(row.slot_id), startsAt: row.slot_starts_at as string, endsAt: row.slot_ends_at as string }
      : null;

  return {
    applicationId: Number(row.application_id),
    roundId: Number(row.round_id),
    roundTitle: row.round_title as string,
    name: row.name as string,
    studentNumber: row.student_number as string,
    phone: row.phone as string,
    email: row.email as string,
    appliedAt: row.applied_at as string,
    slot,
    interview: {
      id: interviewId,
      status,
      score: row.score === null || row.score === undefined ? null : Number(row.score),
      comment: (row.comment as string | null) ?? null,
      resultPublished: resultPublishedAt !== null,
      resultPublishedAt,
      updatedAt: (row.interview_updated_at as string | null) ?? null,
    },
  };
}
