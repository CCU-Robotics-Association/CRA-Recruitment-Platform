import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { config } from '../config.ts';
import type { Db } from '../lib/db.ts';
import { toCamelAll, withTransaction } from '../lib/db.ts';
import { writeAuditLog } from '../lib/audit.ts';
import type { AuthUser } from '../lib/auth.ts';
import { badRequest, conflict, notFound, unauthorized } from '../lib/errors.ts';
import {
  getDummyPasswordHash,
  hashPassword,
  needsPasswordRehash,
  verifyPassword,
} from '../lib/password.ts';
import {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from '../lib/loginThrottle.ts';
import { clearSessionCookie, createCsrfToken, setSessionCookie } from '../lib/session.ts';
import { createRequestRateLimitHook } from '../lib/requestRateLimit.ts';
import { nowIso } from '../lib/time.ts';
import { toCsv } from '../lib/csv.ts';
import {
  applicationCsvHeaders,
  applicationCsvRows,
  deleteApplication,
  getApplication,
  listApplications,
  listApplicationsForExport,
  rescheduleApplication,
} from '../services/applicationService.ts';
import {
  deleteSlotsBatch,
  generateSlots,
  listSlotsWithBooked,
  shiftRoundSlots,
  updateSlot,
  deleteSlot,
} from '../services/slotService.ts';
import { getOverview } from '../services/statsService.ts';
import { deleteRound, getRound } from '../services/roundService.ts';
import type { UserRole } from '../types.ts';

const ROLE_VALUES = ['super_admin', 'admin', 'reviewer'] as const;

export interface AdminContext {
  authenticate: preHandlerHookHandler;
  requireRole: (...roles: UserRole[]) => preHandlerHookHandler;
}

export function registerAdminRoutes(app: FastifyInstance, db: Db, ctx: AdminContext): void {
  registerAuthRoutes(app, db, ctx);
  registerApplicationRoutes(app, db, ctx);
  registerStatsRoutes(app, db, ctx);
  registerSlotRoutes(app, db, ctx);
  registerRoundRoutes(app, db, ctx);
  registerUserRoutes(app, db, ctx);
  registerAuditRoutes(app, db, ctx);
}

function parseIsoDate(value: string, label: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw badRequest(`${label}格式无效`);
  return parsed.toISOString();
}

function validateRoundTimes(
  applyStartAt: string,
  applyEndAt: string,
  interviewStartAt: string | null,
  interviewEndAt: string | null,
): void {
  if (Date.parse(applyEndAt) < Date.parse(applyStartAt)) throw badRequest('报名结束时间不能早于开始时间');
  if (interviewStartAt && interviewEndAt && Date.parse(interviewEndAt) < Date.parse(interviewStartAt)) {
    throw badRequest('面试结束时间不能早于开始时间');
  }
}

function registerAuthRoutes(app: FastifyInstance, db: Db, ctx: AdminContext): void {
  const loginIpLimit = createRequestRateLimitHook(app, {
    max: 30,
    timeWindow: '1 minute',
    keyGenerator: (request) => `admin-login-ip:${request.ip}`,
  });
  const loginIdentifierLimit = createRequestRateLimitHook(app, {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      const body = request.body as { username?: string } | undefined;
      return `admin-login-user:${body?.username?.trim().toLowerCase() ?? 'invalid'}`;
    },
  });

  app.post<{ Body: { username: string; password: string } }>(
    '/api/admin/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password'],
          additionalProperties: false,
          properties: {
            username: { type: 'string', minLength: 1, maxLength: 64 },
            password: { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
      },
      preHandler: [loginIpLimit, loginIdentifierLimit],
    },
    async (request, reply) => {
      const username = request.body.username.trim();
      const password = request.body.password;
      assertLoginAllowed(db, 'admin', username);

      const row = db
        .prepare(
          'SELECT id, username, password_hash, display_name, role, is_active, token_version FROM users WHERE username = ?',
        )
        .get(username) as
        | {
            id: number;
            username: string;
            password_hash: string;
            display_name: string;
            role: UserRole;
            is_active: number;
            token_version: number;
          }
        | undefined;

      const storedHash = row?.password_hash ?? (await getDummyPasswordHash());
      const passwordMatches = await verifyPassword(password, storedHash);
      if (reply.sent || reply.raw.destroyed) return reply;
      if (!row || !passwordMatches || !row.is_active) {
        recordLoginFailure(db, 'admin', username);
        throw unauthorized('用户名或密码错误');
      }

      clearLoginFailures(db, 'admin', username);
      if (needsPasswordRehash(row.password_hash)) {
        const upgradedHash = await hashPassword(password);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
          upgradedHash,
          nowIso(),
          row.id,
        );
      }
      db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), row.id);

      const csrfToken = createCsrfToken();
      const token = app.jwt.sign(
        {
          sub: row.id,
          tv: row.token_version,
          kind: 'admin',
          csrf: csrfToken,
        },
        { expiresIn: `${config.jwtExpiresInSeconds}s` },
      );
      setSessionCookie(reply, 'admin', token);

      return reply.send({
        expiresIn: config.jwtExpiresInSeconds,
        csrfToken,
        user: {
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          role: row.role,
        },
      });
    },
  );

  app.get('/api/admin/auth/me', { preHandler: [ctx.authenticate] }, async (request) => {
    const user = request.user as AuthUser;
    return {
      csrfToken: user.csrfToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    };
  });

  app.post('/api/admin/auth/logout', { preHandler: [ctx.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(user.id);
    clearSessionCookie(reply, 'admin');
    return reply.code(204).send();
  });
}

const VIEWER_ROLES: UserRole[] = ['super_admin', 'admin', 'reviewer'];

function registerApplicationRoutes(app: FastifyInstance, db: Db, ctx: AdminContext): void {
  const viewerGuard = ctx.requireRole(...VIEWER_ROLES);
  const preHandler = [ctx.authenticate, viewerGuard];

  app.get(
    '/api/admin/applications',
    {
      preHandler,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            keyword: { type: 'string', maxLength: 100 },
            slotId: { type: 'integer', minimum: 1 },
            roundId: { type: 'integer', minimum: 1 },
            from: { type: 'string' },
            to: { type: 'string' },
          },
        },
      },
    },
    async (request) => {
      const q = request.query as {
        page?: number;
        pageSize?: number;
        keyword?: string;
        slotId?: number;
        roundId?: number;
        from?: string;
        to?: string;
      };
      return listApplications(db, {
        keyword: q.keyword,
        slotId: q.slotId,
        roundId: q.roundId,
        from: q.from,
        to: q.to,
        page: q.page ?? 1,
        pageSize: q.pageSize ?? 20,
      });
    },
  );

  app.get(
    '/api/admin/applications/export.csv',
    {
      preHandler,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            keyword: { type: 'string', maxLength: 100 },
            slotId: { type: 'integer', minimum: 1 },
            roundId: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query as {
        keyword?: string;
        slotId?: number;
        roundId?: number;
      };
      const apps = listApplicationsForExport(db, {
        keyword: q.keyword,
        slotId: q.slotId,
        roundId: q.roundId,
      });
      const csv = toCsv(applicationCsvHeaders(apps), applicationCsvRows(apps));
      const filename = `cra-applications-${new Date().toISOString().slice(0, 10)}.csv`;
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${filename}"`);
      return reply.send(csv);
    },
  );

  app.get(
    '/api/admin/applications/:id',
    {
      preHandler,
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
      },
    },
    async (request) => {
      const { id } = request.params as { id: number };
      return getApplication(db, id);
    },
  );

  app.delete<{ Params: { id: number } }>(
    '/api/admin/applications/:id',
    {
      preHandler: [ctx.authenticate, ctx.requireRole('super_admin', 'admin')],
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
      },
    },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const { id } = request.params;
      deleteApplication(db, id, user.id, user.displayName);
      return reply.code(204).send();
    },
  );

  const managerGuard = ctx.requireRole('super_admin', 'admin');
  app.put<{ Params: { id: number }; Body: { slotId: number } }>(
    '/api/admin/applications/:id/slot',
    {
      preHandler: [ctx.authenticate, managerGuard],
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
        body: {
          type: 'object',
          required: ['slotId'],
          additionalProperties: false,
          properties: { slotId: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => {
      const user = request.user as AuthUser;
      const { id } = request.params;
      return rescheduleApplication(db, id, user.id, user.displayName, request.body.slotId);
    },
  );
}

function registerStatsRoutes(app: FastifyInstance, db: Db, ctx: AdminContext): void {
  app.get(
    '/api/admin/stats/overview',
    { preHandler: [ctx.authenticate] },
    async () => getOverview(db),
  );
}

function registerSlotRoutes(app: FastifyInstance, db: Db, ctx: AdminContext): void {
  const managerGuard = ctx.requireRole('super_admin', 'admin');
  const preHandler = [ctx.authenticate, managerGuard];

  app.get(
    '/api/admin/slots',
    {
      preHandler,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { roundId: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => {
      const q = request.query as { roundId?: number };
      const roundId =
        q.roundId ??
        ((db.prepare('SELECT id FROM recruitment_rounds ORDER BY id DESC LIMIT 1').get() as
          | { id: number }
          | undefined)?.id ?? -1);
      return listSlotsWithBooked(db, roundId);
    },
  );

  app.post<{
    Body: {
      roundId: number;
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      capacity: number;
      excludeWeekends: boolean;
    };
  }>(
    '/api/admin/slots/generate',
    {
      preHandler,
      schema: {
        body: {
          type: 'object',
          required: ['roundId', 'startDate', 'endDate', 'startTime', 'endTime', 'durationMinutes', 'capacity'],
          additionalProperties: false,
          properties: {
            roundId: { type: 'integer', minimum: 1 },
            startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            startTime: { type: 'string', pattern: '^\\d{1,2}:\\d{2}$' },
            endTime: { type: 'string', pattern: '^\\d{1,2}:\\d{2}$' },
            durationMinutes: { type: 'integer', minimum: 5, maximum: 480 },
            capacity: { type: 'integer', minimum: 1, maximum: 100 },
            excludeWeekends: { type: 'boolean', default: true },
          },
        },
      },
    },
    async (request) => {
      const b = request.body;
      const user = request.user as AuthUser;
      return generateSlots(db, {
        roundId: b.roundId,
        startDate: b.startDate,
        endDate: b.endDate,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes: b.durationMinutes,
        capacity: b.capacity,
        excludeWeekends: b.excludeWeekends ?? true,
      }, user.id, user.displayName);
    },
  );

  app.put<{ Params: { id: number }; Body: { capacity?: number; isEnabled?: boolean } }>(
    '/api/admin/slots/:id',
    {
      preHandler,
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
        body: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: {
            capacity: { type: 'integer', minimum: 1, maximum: 100 },
            isEnabled: { type: 'boolean' },
          },
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const user = request.user as AuthUser;
      return updateSlot(db, id, request.body, user.id, user.displayName);
    },
  );

  app.post<{
    Body: { ids: number[] };
  }>(
    '/api/admin/slots/batch-delete',
    {
      preHandler,
      schema: {
        body: {
          type: 'object',
          required: ['ids'],
          additionalProperties: false,
          properties: {
            ids: { type: 'array', minItems: 1, maxItems: 200, items: { type: 'integer', minimum: 1 } },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as AuthUser;
      return deleteSlotsBatch(db, request.body.ids, user.id, user.displayName);
    },
  );

  app.delete<{ Params: { id: number } }>(
    '/api/admin/slots/:id',
    {
      preHandler,
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user as AuthUser;
      deleteSlot(db, id, user.id, user.displayName);
      return reply.code(204).send();
    },
  );
}

function registerRoundRoutes(app: FastifyInstance, db: Db, ctx: AdminContext): void {
  const managerGuard = ctx.requireRole('super_admin', 'admin');
  const preHandler = [ctx.authenticate, managerGuard];

  app.get('/api/admin/rounds', { preHandler: [ctx.authenticate] }, async () => {
    const rows = db
      .prepare(
        `SELECT r.*,
                (SELECT COUNT(*) FROM applications a WHERE a.round_id = r.id) AS application_count,
                (SELECT COUNT(*) FROM interview_slots s WHERE s.round_id = r.id) AS slot_count
         FROM recruitment_rounds r
         ORDER BY r.id DESC`,
      )
      .all() as unknown as Array<Record<string, unknown>>;
    return { items: toCamelAll(rows) };
  });

  app.put<{ Params: { id: number }; Body: { firstSlotStartsAt: string } }>(
    '/api/admin/rounds/:id/shift-slots',
    {
      preHandler,
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
        body: {
          type: 'object',
          required: ['firstSlotStartsAt'],
          additionalProperties: false,
          properties: {
            firstSlotStartsAt: { type: 'string', minLength: 1, maxLength: 40 },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as AuthUser;
      return shiftRoundSlots(
        db,
        request.params.id,
        request.body.firstSlotStartsAt,
        user.id,
        user.displayName,
      );
    },
  );

  app.post<{
    Body: {
      title: string;
      description?: string;
      applyStartAt: string;
      applyEndAt: string;
      interviewStartAt?: string;
      interviewEndAt?: string;
      isOpen?: boolean;
    };
  }>(
    '/api/admin/rounds',
    {
      preHandler,
      schema: {
        body: {
          type: 'object',
          required: ['title', 'applyStartAt', 'applyEndAt'],
          additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 1000 },
            applyStartAt: { type: 'string' },
            applyEndAt: { type: 'string' },
            interviewStartAt: { type: 'string' },
            interviewEndAt: { type: 'string' },
            isOpen: { type: 'boolean', default: true },
          },
        },
      },
    },
    async (request, reply) => {
      const b = request.body;
      const user = request.user as AuthUser;
      const title = b.title.trim();
      if (!title) throw badRequest('轮次名称不能为空');
      const applyStartAt = parseIsoDate(b.applyStartAt, '报名开始时间');
      const applyEndAt = parseIsoDate(b.applyEndAt, '报名结束时间');
      const interviewStartAt = b.interviewStartAt ? parseIsoDate(b.interviewStartAt, '面试开始时间') : null;
      const interviewEndAt = b.interviewEndAt ? parseIsoDate(b.interviewEndAt, '面试结束时间') : null;
      validateRoundTimes(applyStartAt, applyEndAt, interviewStartAt, interviewEndAt);
      const isOpen = b.isOpen ?? true;
      const now = nowIso();
      const round = withTransaction(db, () => {
        const closedOtherRounds = isOpen
          ? Number(db.prepare('UPDATE recruitment_rounds SET is_open = 0, updated_at = ? WHERE is_open = 1').run(now).changes)
          : 0;
        const info = db.prepare(
          `INSERT INTO recruitment_rounds
             (title, description, apply_start_at, apply_end_at, interview_start_at, interview_end_at, is_open, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          title,
          b.description?.trim() ?? '',
          applyStartAt,
          applyEndAt,
          interviewStartAt,
          interviewEndAt,
          isOpen ? 1 : 0,
          now,
          now,
        );
        const id = Number(info.lastInsertRowid);
        writeAuditLog(db, {
          actorId: user.id,
          actorName: user.displayName,
          action: 'round_create',
          entity: 'recruitment_round',
          entityId: id,
          detail: { title, isOpen, closedOtherRounds },
          createdAt: now,
        });
        return getRound(db, id);
      });
      return reply.code(201).send(round);
    },
  );

  app.put<{
    Params: { id: number };
    Body: {
      title?: string;
      description?: string;
      applyStartAt?: string;
      applyEndAt?: string;
      interviewStartAt?: string | null;
      interviewEndAt?: string | null;
      isOpen?: boolean;
    };
  }>(
    '/api/admin/rounds/:id',
    {
      preHandler,
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
        body: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 1000 },
            applyStartAt: { type: 'string' },
            applyEndAt: { type: 'string' },
            interviewStartAt: { type: ['string', 'null'] },
            interviewEndAt: { type: ['string', 'null'] },
            isOpen: { type: 'boolean' },
          },
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const existing = getRound(db, id);
      const b = request.body;
      const title = b.title === undefined ? existing.title : b.title.trim();
      if (!title) throw badRequest('轮次名称不能为空');
      const applyStartAt = b.applyStartAt
        ? parseIsoDate(b.applyStartAt, '报名开始时间')
        : existing.applyStartAt;
      const applyEndAt = b.applyEndAt ? parseIsoDate(b.applyEndAt, '报名结束时间') : existing.applyEndAt;
      const interviewStartAt =
        b.interviewStartAt === undefined
          ? existing.interviewStartAt
          : b.interviewStartAt === null
            ? null
            : parseIsoDate(b.interviewStartAt, '面试开始时间');
      const interviewEndAt =
        b.interviewEndAt === undefined
          ? existing.interviewEndAt
          : b.interviewEndAt === null
            ? null
            : parseIsoDate(b.interviewEndAt, '面试结束时间');
      validateRoundTimes(applyStartAt, applyEndAt, interviewStartAt, interviewEndAt);
      const isOpen = b.isOpen ?? existing.isOpen;
      const now = nowIso();
      const user = request.user as AuthUser;

      return withTransaction(db, () => {
        const closedOtherRounds = isOpen
          ? Number(db.prepare('UPDATE recruitment_rounds SET is_open = 0, updated_at = ? WHERE is_open = 1 AND id <> ?').run(now, id).changes)
          : 0;
        db.prepare(
          `UPDATE recruitment_rounds
           SET title = ?, description = ?, apply_start_at = ?, apply_end_at = ?,
               interview_start_at = ?, interview_end_at = ?, is_open = ?, updated_at = ?
           WHERE id = ?`,
        ).run(
          title,
          b.description?.trim() ?? existing.description,
          applyStartAt,
          applyEndAt,
          interviewStartAt,
          interviewEndAt,
          isOpen ? 1 : 0,
          now,
          id,
        );
        const updated = getRound(db, id);
        writeAuditLog(db, {
          actorId: user.id,
          actorName: user.displayName,
          action: 'round_update',
          entity: 'recruitment_round',
          entityId: id,
          detail: { from: existing, to: updated, closedOtherRounds },
          createdAt: now,
        });
        return updated;
      });
    },
  );

  app.delete<{ Params: { id: number } }>(
    '/api/admin/rounds/:id',
    {
      preHandler,
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
      },
    },
    async (request, reply) => {
      const user = request.user as AuthUser;
      const { id } = request.params;
      deleteRound(db, id, user.id, user.displayName);
      return reply.code(204).send();
    },
  );
}

function registerUserRoutes(app: FastifyInstance, db: Db, ctx: AdminContext): void {
  const superOnlyPreHandler = [ctx.authenticate, ctx.requireRole('super_admin')];

  app.get('/api/admin/users', { preHandler: superOnlyPreHandler }, async () => {
    const rows = db
      .prepare(
        'SELECT id, username, display_name, role, is_active, last_login_at, created_at, updated_at FROM users ORDER BY id ASC',
      )
      .all() as unknown as Array<Record<string, unknown>>;
    return { items: toCamelAll(rows) };
  });

  app.post<{
    Body: { username: string; password: string; displayName: string; role: UserRole };
  }>(
    '/api/admin/users',
    {
      preHandler: superOnlyPreHandler,
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password', 'displayName', 'role'],
          additionalProperties: false,
          properties: {
            username: { type: 'string', minLength: 2, maxLength: 64, pattern: '^[a-zA-Z0-9_.-]+$' },
            password: { type: 'string', minLength: 8, maxLength: 128 },
            displayName: { type: 'string', minLength: 1, maxLength: 64 },
            role: { type: 'string', enum: ROLE_VALUES },
          },
        },
      },
    },
    async (request, reply) => {
      const b = request.body;
      const username = b.username.trim();
      const displayName = b.displayName.trim();
      if (!displayName) throw badRequest('显示名称不能为空');
      const now = nowIso();
      const passwordHash = await hashPassword(b.password);
      if (reply.sent || reply.raw.destroyed) return reply;
      const actor = request.user as AuthUser;
      const id = withTransaction(db, () => {
        const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
        if (exists) throw conflict('用户名已存在');
        const info = db.prepare(
          'INSERT INTO users (username, password_hash, display_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
        ).run(username, passwordHash, displayName, b.role, now, now);
        const createdId = Number(info.lastInsertRowid);
        writeAuditLog(db, {
          actorId: actor.id,
          actorName: actor.displayName,
          action: 'admin_user_create',
          entity: 'user',
          entityId: createdId,
          detail: { username, displayName, role: b.role },
          createdAt: now,
        });
        return createdId;
      });
      return reply.code(201).send({ id, username });
    },
  );

  app.put<{
    Params: { id: number };
    Body: { displayName?: string; role?: UserRole; isActive?: boolean };
  }>(
    '/api/admin/users/:id',
    {
      preHandler: superOnlyPreHandler,
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
        body: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: {
            displayName: { type: 'string', minLength: 1, maxLength: 64 },
            role: { type: 'string', enum: ROLE_VALUES },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const row = db
        .prepare('SELECT id, display_name, role, is_active FROM users WHERE id = ?')
        .get(id) as { id: number; display_name: string; role: UserRole; is_active: number } | undefined;
      if (!row) throw notFound('用户不存在');

      const actor = request.user as AuthUser;
      if (row.id === actor.id && request.body.isActive === false) {
        throw badRequest('不能停用自己的账号');
      }
      if (row.id === actor.id && request.body.role && request.body.role !== 'super_admin') {
        throw badRequest('不能降低自己的权限');
      }

      const displayName = request.body.displayName?.trim() ?? row.display_name;
      if (!displayName) throw badRequest('显示名称不能为空');
      const role = request.body.role ?? row.role;
      const isActive = request.body.isActive === undefined ? row.is_active : request.body.isActive ? 1 : 0;
      const tokenBump = request.body.isActive === false ? 1 : 0;

      const now = nowIso();
      withTransaction(db, () => {
        db.prepare(
          `UPDATE users SET display_name = ?, role = ?, is_active = ?, token_version = token_version + ?, updated_at = ? WHERE id = ?`,
        ).run(displayName, role, isActive, tokenBump, now, id);
        writeAuditLog(db, {
          actorId: actor.id,
          actorName: actor.displayName,
          action: 'admin_user_update',
          entity: 'user',
          entityId: id,
          detail: {
            from: { displayName: row.display_name, role: row.role, isActive: row.is_active === 1 },
            to: { displayName, role, isActive: isActive === 1 },
          },
          createdAt: now,
        });
      });

      return { id, displayName, role, isActive: isActive === 1 };
    },
  );

  app.post<{ Params: { id: number }; Body: { password: string } }>(
    '/api/admin/users/:id/reset-password',
    {
      preHandler: superOnlyPreHandler,
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
        body: {
          type: 'object',
          required: ['password'],
          additionalProperties: false,
          properties: { password: { type: 'string', minLength: 8, maxLength: 128 } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const passwordHash = await hashPassword(request.body.password);
      if (reply.sent || reply.raw.destroyed) return reply;
      const actor = request.user as AuthUser;
      const now = nowIso();
      withTransaction(db, () => {
        const row = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as { username: string } | undefined;
        if (!row) throw notFound('用户不存在');
        db.prepare(
          'UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?',
        ).run(passwordHash, now, id);
        writeAuditLog(db, {
          actorId: actor.id,
          actorName: actor.displayName,
          action: 'admin_password_reset',
          entity: 'user',
          entityId: id,
          detail: { username: row.username },
          createdAt: now,
        });
      });
      return { id, message: '密码已重置' };
    },
  );
}

function registerAuditRoutes(app: FastifyInstance, db: Db, ctx: AdminContext): void {
  app.get(
    '/api/admin/audit-logs',
    {
      preHandler: [ctx.authenticate, ctx.requireRole('super_admin')],
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            action: { type: 'string', maxLength: 64 },
            entity: { type: 'string', maxLength: 64 },
          },
        },
      },
    },
    async (request) => {
      const q = request.query as { page?: number; pageSize?: number; action?: string; entity?: string };
      const page = q.page ?? 1;
      const pageSize = q.pageSize ?? 20;
      const conditions: string[] = [];
      const params: string[] = [];
      if (q.action?.trim()) {
        conditions.push('action = ?');
        params.push(q.action.trim());
      }
      if (q.entity?.trim()) {
        conditions.push('entity = ?');
        params.push(q.entity.trim());
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const total = (db.prepare(`SELECT COUNT(*) AS c FROM audit_logs ${where}`).get(...params) as { c: number }).c;
      const rows = db.prepare(
        `SELECT id, actor_id, actor_name, action, entity, entity_id, detail, created_at
         FROM audit_logs ${where}
         ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      ).all(...params, pageSize, (page - 1) * pageSize) as Array<Record<string, unknown>>;
      return {
        items: toCamelAll(rows).map((row) => {
          if (typeof row.detail === 'string') {
            try {
              row.detail = JSON.parse(row.detail) as unknown;
            } catch {
            }
          }
          return row;
        }),
        total,
        page,
        pageSize,
      };
    },
  );
}
