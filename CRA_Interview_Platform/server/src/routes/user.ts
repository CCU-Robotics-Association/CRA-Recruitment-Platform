/**
 * 用户端 API（候选人侧，学号 + 手机号登录）：
 * - POST /api/user/auth/login                登录（学号 + 手机号）
 * - GET  /api/user/auth/me                   当前登录信息
 * - GET  /api/user/me                        我的报名与面试全景（结果仅在管理端发布后可见）
 */
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { Db } from '../lib/db.ts';
import type { UserAuthInfo } from '../lib/auth.ts';
import { badRequest, unauthorized } from '../lib/errors.ts';
import { getApplication } from '../services/applicationService.ts';
import { getInterviewByApplication } from '../services/interviewService.ts';
import { getRound } from '../services/roundService.ts';
import { APPLICATION_STATUS_LABELS, INTERVIEW_STATUS_LABELS } from '../types.ts';
import type { ApplicationStatus, InterviewStatus } from '../types.ts';

export interface UserContext {
  authenticateUser: preHandlerHookHandler;
}

const loginBody = {
  type: 'object',
  required: ['studentNumber', 'phone'],
  additionalProperties: false,
  properties: {
    studentNumber: { type: 'string', pattern: '^\\d{9}$' },
    phone: { type: 'string', pattern: '^1[3-9]\\d{9}$' },
  },
} as const;

interface LoginBody {
  studentNumber: string;
  phone: string;
}

export function registerUserRoutes(app: FastifyInstance, db: Db, ctx: UserContext): void {
  app.post<{ Body: LoginBody }>(
    '/api/user/auth/login',
    {
      schema: { body: loginBody },
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const studentNumber = request.body.studentNumber.trim();
      const phone = request.body.phone.trim();
      if (!/^\d{9}$/.test(studentNumber)) throw badRequest('学号应为 9 位数字');
      if (!/^1[3-9]\d{9}$/.test(phone)) throw badRequest('手机号格式不正确');

      // 学号 + 手机号同时匹配才视为本人；匹配多条时取最新一条（当前轮次）
      const row = db
        .prepare(
          `SELECT id, name, student_number, email, phone
           FROM applications
           WHERE student_number = ? AND phone = ?
           ORDER BY id DESC LIMIT 1`,
        )
        .get(studentNumber, phone) as
        | { id: number; name: string; student_number: string; email: string; phone: string }
        | undefined;

      // 统一错误信息，避免枚举有效账号
      if (!row) throw unauthorized('学号或手机号不正确');

      const expiresIn = 12 * 60 * 60;
      const token = app.jwt.sign(
        { sub: row.id, kind: 'user', name: row.name, studentNumber: row.student_number },
        { expiresIn: `${expiresIn}s` },
      );

      return reply.send({
        token,
        expiresIn,
        user: {
          applicationId: row.id,
          name: row.name,
          studentNumber: row.student_number,
          phone: row.phone,
          email: row.email,
        },
      });
    },
  );

  app.get('/api/user/auth/me', { preHandler: [ctx.authenticateUser] }, async (request) => {
    const user = request.user as unknown as UserAuthInfo;
    return { user: { applicationId: user.id, name: user.name, studentNumber: user.studentNumber, phone: user.phone } };
  });

  app.get('/api/user/me', { preHandler: [ctx.authenticateUser] }, async (request) => {
    const user = request.user as unknown as UserAuthInfo;
    const applicationId = user.id;
    const application = getApplication(db, applicationId);
    const round = getRound(db, application.roundId);
    const interview = getInterviewByApplication(db, applicationId);

    const resultVisible = interview?.resultPublishedAt !== null && interview !== null;

    return {
      application: {
        id: application.id,
        name: application.name,
        studentNumber: application.studentNumber,
        phone: application.phone,
        email: application.email,
        status: application.status,
        statusLabel: APPLICATION_STATUS_LABELS[application.status as ApplicationStatus],
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        round: {
          id: round.id,
          title: round.title,
          description: round.description,
          applyStartAt: round.applyStartAt,
          applyEndAt: round.applyEndAt,
          interviewStartAt: round.interviewStartAt,
          interviewEndAt: round.interviewEndAt,
        },
        slot: application.slot ?? null,
      },
      interview: interview
        ? {
            status: interview.status,
            statusLabel: INTERVIEW_STATUS_LABELS[interview.status as InterviewStatus],
            // 评分/评语仅在管理端发布结果后对候选人可见
            score: resultVisible ? interview.score : null,
            comment: resultVisible ? interview.comment : null,
            resultPublished: resultVisible,
            resultPublishedAt: interview.resultPublishedAt,
            updatedAt: interview.updatedAt,
          }
        : null,
      resultVisible,
    };
  });
}
