/**
 * 管理 API（JWT 鉴权 + 角色分级）：
 * 认证、报名管理/审核/导出、统计、时段、轮次、账号管理。
 */
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { Db } from '../lib/db.ts';
import { toCamelAll } from '../lib/db.ts';
import type { AuthUser } from '../lib/auth.ts';
import { badRequest, conflict, notFound, unauthorized } from '../lib/errors.ts';
import { verifyPassword, hashPassword } from '../lib/password.ts';
import { nowIso } from '../lib/time.ts';
import { toCsv } from '../lib/csv.ts';
import {
  applicationCsvHeaders,
  applicationCsvRows,
  deleteApplication,
  getApplication,
  listApplications,
  listApplicationsForExport,
  reviewApplication,
} from '../services/applicationService.ts';
import { generateSlots, listSlotsWithBooked, updateSlot, deleteSlot } from '../services/slotService.ts';
import { getOverview } from '../services/statsService.ts';
import { getRound } from '../services/roundService.ts';
import type { ApplicationStatus, UserRole } from '../types.ts';
import { APPLICATION_STATUSES } from '../types.ts';

const STATUS_VALUES = APPLICATION_STATUSES as readonly string[];
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
}

/* ------------------------------ 认证 ------------------------------ */

function registerAuthRoutes(app: FastifyInstance, db: Db, ctx: AdminContext): void {
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { username, password } = request.body;
      const row = db
        .prepare(
          'SELECT id, username, password_hash, display_name, role, is_active, token_version FROM users WHERE username = ?',
        )
        .get(username.trim()) as
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

      // 统一错误信息，避免账号枚举
      if (!row || !verifyPassword(password, row.password_hash)) {
        throw unauthorized('用户名或密码错误');
      }
      if (!row.is_active) throw unauthorized('账号已被停用，请联系管理员');

      db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), row.id);

      const expiresIn = 12 * 60 * 60;
      const token = app.jwt.sign(
        { sub: row.id, username: row.username, role: row.role, tv: row.token_version },
        { expiresIn: `${expiresIn}s` },
      );

      return reply.send({
        token,
        expiresIn,
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
    return { user };
  });
}

/* ---------------------------- 报名管理 ---------------------------- */

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
            status: { type: 'string', enum: STATUS_VALUES },
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
        status?: ApplicationStatus;
        keyword?: string;
        slotId?: number;
        roundId?: number;
        from?: string;
        to?: string;
      };
      return listApplications(db, {
        status: q.status,
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
            status: { type: 'string', enum: STATUS_VALUES },
            keyword: { type: 'string', maxLength: 100 },
            slotId: { type: 'integer', minimum: 1 },
            roundId: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query as {
        status?: ApplicationStatus;
        keyword?: string;
        slotId?: number;
        roundId?: number;
      };
      const apps = listApplicationsForExport(db, {
        status: q.status,
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
      preHandler,
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

  app.patch<{ Params: { id: number }; Body: { status: ApplicationStatus; note?: string } }>(
    '/api/admin/applications/:id/status',
    {
      preHandler,
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
        body: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: STATUS_VALUES },
            note: { type: 'string', maxLength: 2000 },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as AuthUser;
      const { id } = request.params;
      return reviewApplication(db, id, user.id, user.displayName, {
        status: request.body.status,
        note: request.body.note,
      });
    },
  );
}

/* ------------------------------ 统计 ------------------------------ */

function registerStatsRoutes(app: FastifyInstance, db: Db, ctx: AdminContext): void {
  app.get(
    '/api/admin/stats/overview',
    { preHandler: [ctx.authenticate] },
    async () => getOverview(db),
  );
}

/* ------------------------------ 时段 ------------------------------ */

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
      return generateSlots(db, {
        roundId: b.roundId,
        startDate: b.startDate,
        endDate: b.endDate,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes: b.durationMinutes,
        capacity: b.capacity,
        excludeWeekends: b.excludeWeekends ?? true,
      });
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
      return updateSlot(db, id, request.body);
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
      deleteSlot(db, id);
      return reply.code(204).send();
    },
  );
}

/* ------------------------------ 轮次 ------------------------------ */

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
      const now = nowIso();
      const info = db
        .prepare(
          `INSERT INTO recruitment_rounds
             (title, description, apply_start_at, apply_end_at, interview_start_at, interview_end_at, is_open, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          b.title.trim(),
          b.description?.trim() ?? '',
          new Date(b.applyStartAt).toISOString(),
          new Date(b.applyEndAt).toISOString(),
          b.interviewStartAt ? new Date(b.interviewStartAt).toISOString() : null,
          b.interviewEndAt ? new Date(b.interviewEndAt).toISOString() : null,
          b.isOpen === undefined ? 1 : b.isOpen ? 1 : 0,
          now,
          now,
        );
      const round = getRound(db, Number(info.lastInsertRowid));
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
      const applyStartAt = b.applyStartAt ? new Date(b.applyStartAt).toISOString() : existing.applyStartAt;
      const applyEndAt = b.applyEndAt ? new Date(b.applyEndAt).toISOString() : existing.applyEndAt;
      if (new Date(applyEndAt).getTime() < new Date(applyStartAt).getTime()) {
        throw badRequest('报名结束时间不能早于开始时间');
      }
      db.prepare(
        `UPDATE recruitment_rounds
         SET title = ?, description = ?, apply_start_at = ?, apply_end_at = ?,
             interview_start_at = ?, interview_end_at = ?, is_open = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        b.title?.trim() ?? existing.title,
        b.description?.trim() ?? existing.description,
        applyStartAt,
        applyEndAt,
        b.interviewStartAt === undefined ? existing.interviewStartAt : b.interviewStartAt === null ? null : new Date(b.interviewStartAt).toISOString(),
        b.interviewEndAt === undefined ? existing.interviewEndAt : b.interviewEndAt === null ? null : new Date(b.interviewEndAt).toISOString(),
        b.isOpen === undefined ? existing.isOpen : b.isOpen ? 1 : 0,
        nowIso(),
        id,
      );
      return getRound(db, id);
    },
  );
}

/* ------------------------------ 账号 ------------------------------ */

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
      const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(b.username.trim());
      if (exists) throw conflict('用户名已存在');
      const now = nowIso();
      const info = db
        .prepare(
          'INSERT INTO users (username, password_hash, display_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
        )
        .run(b.username.trim(), hashPassword(b.password), b.displayName.trim(), b.role, now, now);
      return reply.code(201).send({ id: Number(info.lastInsertRowid), username: b.username.trim() });
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
      const role = request.body.role ?? row.role;
      const isActive = request.body.isActive === undefined ? row.is_active : request.body.isActive ? 1 : 0;
      // 停用账号使其已签发令牌立即失效
      const tokenBump = request.body.isActive === false ? 1 : 0;

      db.prepare(
        `UPDATE users SET display_name = ?, role = ?, is_active = ?, token_version = token_version + ?, updated_at = ? WHERE id = ?`,
      ).run(displayName, role, isActive, tokenBump, nowIso(), id);

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
    async (request) => {
      const { id } = request.params;
      const row = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
      if (!row) throw notFound('用户不存在');
      // 重置密码使该用户所有已签发令牌失效
      db.prepare(
        'UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?',
      ).run(hashPassword(request.body.password), nowIso(), id);
      return { id, message: '密码已重置' };
    },
  );
}
