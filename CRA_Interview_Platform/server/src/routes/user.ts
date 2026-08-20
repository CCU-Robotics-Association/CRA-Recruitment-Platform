import type { FastifyInstance, FastifyReply, preHandlerHookHandler } from 'fastify';
import { randomUUID } from 'node:crypto';
import { config } from '../config.ts';
import type { Db } from '../lib/db.ts';
import { withTransaction } from '../lib/db.ts';
import { writeAuditLog } from '../lib/audit.ts';
import { sendVerificationEmail } from '../lib/mailer.ts';
import type { UserAuthInfo } from '../lib/auth.ts';
import { badRequest, unauthorized } from '../lib/errors.ts';
import {
  getDummyPasswordHash,
  hashPassword,
  isCandidatePasswordValid,
  needsPasswordRehash,
  verifyPassword,
} from '../lib/password.ts';
import {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from '../lib/loginThrottle.ts';
import {
  clearSessionCookie,
  createCsrfToken,
  setSessionCookie,
} from '../lib/session.ts';
import { createRequestRateLimitHook } from '../lib/requestRateLimit.ts';
import { nowIso } from '../lib/time.ts';
import { getApplication, updateCandidateApplication } from '../services/applicationService.ts';
import {
  consumeEmailChallenge,
  createEmailChallenge,
  removeEmailChallenge,
  verifyEmailChallenge,
} from '../services/emailVerificationService.ts';
import { applyPhase, getRound } from '../services/roundService.ts';
import { listSlotsWithBooked } from '../services/slotService.ts';
import { COLLEGE_VALUES } from '../types.ts';

export interface UserContext {
  authenticateUser: preHandlerHookHandler;
}

const loginBody = {
  type: 'object',
  required: ['studentNumber', 'password'],
  additionalProperties: false,
  properties: {
    studentNumber: { type: 'string', pattern: '^\\d{9}$' },
    password: { type: 'string', minLength: 8, maxLength: 32 },
  },
} as const;

interface LoginBody {
  studentNumber: string;
  password: string;
}

interface PasswordResetRequestBody {
  studentNumber: string;
  email: string;
}

interface PasswordResetBody extends PasswordResetRequestBody {
  verificationId: string;
  verificationCode: string;
  newPassword: string;
}

const passwordResetRequestBody = {
  type: 'object',
  required: ['studentNumber', 'email'],
  additionalProperties: false,
  properties: {
    studentNumber: { type: 'string', pattern: '^\\d{9}$' },
    email: { type: 'string', minLength: 3, maxLength: 254, format: 'email' },
  },
} as const;

const passwordResetBody = {
  type: 'object',
  required: ['studentNumber', 'email', 'verificationId', 'verificationCode', 'newPassword'],
  additionalProperties: false,
  properties: {
    ...passwordResetRequestBody.properties,
    verificationId: { type: 'string', minLength: 20, maxLength: 64 },
    verificationCode: { type: 'string', pattern: '^\\d{6}$' },
    newPassword: { type: 'string', minLength: 8, maxLength: 32 },
  },
} as const;

const answersSchema = {
  type: 'object',
  minProperties: 1,
  maxProperties: 20,
  additionalProperties: { type: 'string', maxLength: 2000 },
} as const;

const updateApplicationBody = {
  type: 'object',
  required: ['name', 'gender', 'college', 'email', 'phone', 'slotId', 'answers'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 64 },
    gender: { type: 'string', enum: ['male', 'female'] },
    college: { type: 'string', enum: COLLEGE_VALUES },
    email: { type: 'string', minLength: 3, maxLength: 254, format: 'email' },
    phone: { type: 'string', pattern: '^1[3-9]\\d{9}$' },
    emailVerificationId: { type: 'string', minLength: 20, maxLength: 64 },
    emailVerificationCode: { type: 'string', pattern: '^\\d{6}$' },
    slotId: { type: 'integer', minimum: 1 },
    answers: answersSchema,
  },
} as const;

interface UpdateApplicationBody {
  name: string;
  gender: 'male' | 'female';
  college: (typeof COLLEGE_VALUES)[number];
  email: string;
  phone: string;
  emailVerificationId?: string;
  emailVerificationCode?: string;
  slotId: number;
  answers: Record<string, string>;
}

interface CandidateRecord {
  id: number;
  name: string;
  student_number: string;
  email: string;
  phone: string;
  password_hash: string | null;
  token_version: number;
}

function createCandidateSession(
  app: FastifyInstance,
  reply: FastifyReply,
  row: CandidateRecord,
) {
  const csrfToken = createCsrfToken();
  const token = app.jwt.sign(
    {
      sub: row.id,
      kind: 'user',
      tv: row.token_version,
      csrf: csrfToken,
    },
    { expiresIn: `${config.jwtExpiresInSeconds}s` },
  );
  setSessionCookie(reply, 'candidate', token);

  return {
    expiresIn: config.jwtExpiresInSeconds,
    csrfToken,
    user: {
      applicationId: row.id,
      name: row.name,
      studentNumber: row.student_number,
      phone: row.phone,
      email: row.email,
    },
  };
}

function candidateOverview(db: Db, applicationId: number) {
  const application = getApplication(db, applicationId);
  const round = getRound(db, application.roundId);
  const phase = applyPhase(round);

  return {
    editable: phase === 'open',
    applyPhase: phase,
    application: {
      id: application.id,
      name: application.name,
      studentNumber: application.studentNumber,
      gender: application.gender,
      college: application.college,
      phone: application.phone,
      email: application.email,
      answers: application.answers,
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
  };
}

export function registerUserRoutes(app: FastifyInstance, db: Db, ctx: UserContext): void {
  const loginIpLimit = createRequestRateLimitHook(app, {
    max: 240,
    timeWindow: '1 minute',
    keyGenerator: (request) => `candidate-login-ip:${request.ip}`,
  });
  const loginIdentifierLimit = createRequestRateLimitHook(app, {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      const body = request.body as Partial<LoginBody> | undefined;
      return `candidate-login-student:${body?.studentNumber?.trim() ?? 'invalid'}`;
    },
  });
  const updateApplicationLimit = createRequestRateLimitHook(app, {
    max: 30,
    timeWindow: '15 minutes',
    keyGenerator: (request) => {
      const user = request.user as unknown as UserAuthInfo | undefined;
      return `candidate-update:${user?.id ?? request.ip}`;
    },
  });
  const passwordResetIpLimit = createRequestRateLimitHook(app, {
    max: 10,
    timeWindow: '15 minutes',
    keyGenerator: (request) => 'candidate-reset-ip:' + request.ip,
  });
  const passwordResetTargetLimit = createRequestRateLimitHook(app, {
    max: 4,
    timeWindow: '15 minutes',
    keyGenerator: (request) => {
      const body = request.body as Partial<PasswordResetRequestBody> | undefined;
      return (
        'candidate-reset-target:' +
        (body?.studentNumber?.trim() ?? 'invalid') +
        ':' +
        (body?.email?.trim().toLowerCase() ?? 'invalid')
      );
    },
  });

  app.post<{ Body: PasswordResetRequestBody }>(
    '/api/user/auth/password-reset/request',
    {
      schema: { body: passwordResetRequestBody },
      preHandler: [passwordResetIpLimit, passwordResetTargetLimit],
    },
    async (request, reply) => {
      const studentNumber = request.body.studentNumber.trim();
      const email = request.body.email.trim().toLowerCase();
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      let verificationId: string = randomUUID();
      let devCode: string | undefined;
      const row = db
        .prepare('SELECT id FROM applications WHERE student_number = ? AND email = ? ORDER BY id DESC LIMIT 1')
        .get(studentNumber, email) as { id: number } | undefined;

      if (row) {
        const challenge = createEmailChallenge(db, 'password_reset', studentNumber, email);
        verificationId = challenge.id;
        try {
          const delivered = await sendVerificationEmail(email, challenge.code, 'password_reset');
          if (!delivered && !config.isProduction) devCode = challenge.code;
        } catch (error) {
          removeEmailChallenge(db, challenge.id);
          verificationId = randomUUID();
          request.log.error({ err: error }, 'password reset email failed');
        }
      }

      return reply.code(202).send({
        verificationId,
        expiresAt,
        message: '如果学号与邮箱匹配，验证码将发送到该邮箱',
        ...(devCode ? { devCode } : {}),
      });
    },
  );

  app.post<{ Body: PasswordResetBody }>(
    '/api/user/auth/password-reset/confirm',
    {
      schema: { body: passwordResetBody },
      preHandler: [passwordResetIpLimit, passwordResetTargetLimit],
    },
    async (request, reply) => {
      const studentNumber = request.body.studentNumber.trim();
      const email = request.body.email.trim().toLowerCase();
      if (!isCandidatePasswordValid(request.body.newPassword)) {
        throw badRequest('密码需为 8–32 位，并同时包含英文字母和数字');
      }
      const challenge = verifyEmailChallenge(db, {
        id: request.body.verificationId,
        purpose: 'password_reset',
        studentNumber,
        email,
        code: request.body.verificationCode,
      });
      const row = db
        .prepare('SELECT id FROM applications WHERE student_number = ? AND email = ? ORDER BY id DESC LIMIT 1')
        .get(studentNumber, email) as { id: number } | undefined;
      if (!row) throw badRequest('验证码无效或已过期，请重新获取');

      const passwordHash = await hashPassword(request.body.newPassword);
      if (reply.sent || reply.raw.destroyed) return reply;
      withTransaction(db, () => {
        consumeEmailChallenge(db, challenge, 'password_reset');
        const changed = db
          .prepare(
            'UPDATE applications SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?',
          )
          .run(passwordHash, nowIso(), row.id);
        if (Number(changed.changes) !== 1) throw badRequest('报名记录不存在');
        writeAuditLog(db, {
          actorId: null,
          actorName: '候选人自助找回',
          action: 'candidate_password_reset',
          entity: 'application',
          entityId: row.id,
          detail: { sessionsInvalidated: true },
          createdAt: nowIso(),
        });
      });
      clearLoginFailures(db, 'candidate', studentNumber);
      return reply.send({ message: '密码已重置，请使用新密码登录' });
    },
  );

  app.post<{ Body: LoginBody }>(
    '/api/user/auth/login',
    {
      schema: { body: loginBody },
      preHandler: [loginIpLimit, loginIdentifierLimit],
    },
    async (request, reply) => {
      const studentNumber = request.body.studentNumber.trim();
      const password = request.body.password;
      if (!/^\d{9}$/.test(studentNumber)) throw badRequest('学号应为 9 位数字');
      if (!isCandidatePasswordValid(password)) throw badRequest('密码需为 8–32 位，并同时包含英文字母和数字');

      assertLoginAllowed(db, 'candidate', studentNumber);
      const row = db
        .prepare(
          'SELECT id, name, student_number, email, phone, password_hash, token_version ' +
          'FROM applications WHERE student_number = ? ORDER BY id DESC LIMIT 1',
        )
        .get(studentNumber) as CandidateRecord | undefined;

      const storedHash = row?.password_hash ?? (await getDummyPasswordHash());
      const passwordMatches = await verifyPassword(password, storedHash);
      if (reply.sent || reply.raw.destroyed) return reply;
      if (!row || !row.password_hash || !passwordMatches) {
        recordLoginFailure(db, 'candidate', studentNumber);
        throw unauthorized('学号或密码不正确');
      }

      clearLoginFailures(db, 'candidate', studentNumber);
      if (needsPasswordRehash(row.password_hash)) {
        const upgradedHash = await hashPassword(password);
        db.prepare('UPDATE applications SET password_hash = ?, updated_at = ? WHERE id = ?').run(
          upgradedHash,
          new Date().toISOString(),
          row.id,
        );
      }

      return reply.send(createCandidateSession(app, reply, row));
    },
  );

  app.get('/api/user/auth/me', { preHandler: [ctx.authenticateUser] }, async (request) => {
    const user = request.user as unknown as UserAuthInfo;
    return {
      csrfToken: user.csrfToken,
      user: {
        applicationId: user.id,
        name: user.name,
        studentNumber: user.studentNumber,
        phone: user.phone,
      },
    };
  });

  app.post('/api/user/auth/logout', { preHandler: [ctx.authenticateUser] }, async (request, reply) => {
    const user = request.user as unknown as UserAuthInfo;
    db.prepare('UPDATE applications SET token_version = token_version + 1 WHERE id = ?').run(user.id);
    clearSessionCookie(reply, 'candidate');
    return reply.code(204).send();
  });

  app.get('/api/user/me', { preHandler: [ctx.authenticateUser] }, async (request) => {
    const user = request.user as unknown as UserAuthInfo;
    return candidateOverview(db, user.id);
  });

  app.get('/api/user/me/slots', { preHandler: [ctx.authenticateUser] }, async (request) => {
    const user = request.user as unknown as UserAuthInfo;
    const application = getApplication(db, user.id);
    const round = getRound(db, application.roundId);
    return {
      editable: applyPhase(round) === 'open',
      slots: listSlotsWithBooked(db, round.id)
        .filter(
          (slot) =>
            slot.isEnabled === 1 &&
            (slot.remaining > 0 || slot.id === application.slotId),
        )
        .map((slot) => ({
          id: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          remaining: slot.remaining,
          current: slot.id === application.slotId,
        })),
    };
  });

  app.put<{ Body: UpdateApplicationBody }>(
    '/api/user/me',
    {
      schema: { body: updateApplicationBody },
      preHandler: [ctx.authenticateUser, updateApplicationLimit],
    },
    async (request) => {
      const user = request.user as unknown as UserAuthInfo;
      const name = request.body.name.trim();
      const email = request.body.email.trim().toLowerCase();
      const phone = request.body.phone.trim();
      if (!name) throw badRequest('姓名不能为空');
      if (!/^1[3-9]\d{9}$/.test(phone)) throw badRequest('手机号格式不正确');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('邮箱格式不正确');
      const current = getApplication(db, user.id);
      let emailChallenge: { id: string; targetDigest: string } | undefined;
      if (email !== current.email.trim().toLowerCase()) {
        if (!request.body.emailVerificationId || !request.body.emailVerificationCode) {
          throw badRequest('修改邮箱前请验证新邮箱');
        }
        emailChallenge = verifyEmailChallenge(db, {
          id: request.body.emailVerificationId,
          purpose: 'registration',
          studentNumber: current.studentNumber,
          email,
          code: request.body.emailVerificationCode,
        });
      }

      const answers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.body.answers)) {
        const text = String(value ?? '').trim();
        if (!text) throw badRequest(`请完整填写问题「${key}」的答案`);
        if (text.length > 2000) throw badRequest(`问题「${key}」的答案过长（最多 2000 字）`);
        answers[key] = text;
      }

      updateCandidateApplication(db, user.id, {
        name,
        gender: request.body.gender,
        college: request.body.college,
        email,
        phone,
        slotId: request.body.slotId,
        answers,
        emailChallenge,
      });
      return candidateOverview(db, user.id);
    },
  );
}
