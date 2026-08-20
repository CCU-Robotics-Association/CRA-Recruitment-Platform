import type { FastifyInstance } from 'fastify';
import type { Db } from '../lib/db.ts';
import { badRequest, serviceUnavailable } from '../lib/errors.ts';
import { config } from '../config.ts';
import { sendVerificationEmail } from '../lib/mailer.ts';
import { isCandidatePasswordValid } from '../lib/password.ts';
import { createRequestRateLimitHook } from '../lib/requestRateLimit.ts';
import { applyPhase, getActiveRound } from '../services/roundService.ts';
import { listSlotsWithBooked } from '../services/slotService.ts';
import { createApplication } from '../services/applicationService.ts';
import {
  createEmailChallenge,
  removeEmailChallenge,
  verifyEmailChallenge,
} from '../services/emailVerificationService.ts';
import { COLLEGE_VALUES } from '../types.ts';

const answersSchema = {
  type: 'object',
  minProperties: 1,
  maxProperties: 20,
  additionalProperties: { type: 'string', maxLength: 2000 },
} as const;

const createApplicationBody = {
  type: 'object',
  required: [
    'name',
    'studentNumber',
    'gender',
    'college',
    'email',
    'phone',
    'password',
    'emailVerificationId',
    'emailVerificationCode',
    'slotId',
    'answers',
  ],
  additionalProperties: false,
  properties: {
    roundId: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1, maxLength: 64 },
    studentNumber: { type: 'string', pattern: '^\\d{9}$' },
    gender: { type: 'string', enum: ['male', 'female'] },
    college: { type: 'string', enum: COLLEGE_VALUES },
    email: { type: 'string', minLength: 3, maxLength: 254, format: 'email' },
    phone: { type: 'string', pattern: '^1[3-9]\\d{9}$' },
    password: { type: 'string', minLength: 8, maxLength: 32 },
    emailVerificationId: { type: 'string', minLength: 20, maxLength: 64 },
    emailVerificationCode: { type: 'string', pattern: '^\\d{6}$' },
    slotId: { type: 'integer', minimum: 1 },
    answers: answersSchema,
  },
} as const;

interface CreateApplicationBody {
  roundId?: number;
  name: string;
  studentNumber: string;
  gender: 'male' | 'female';
  college: (typeof COLLEGE_VALUES)[number];
  email: string;
  phone: string;
  password: string;
  emailVerificationId: string;
  emailVerificationCode: string;
  slotId: number;
  answers: Record<string, string>;
}

interface RequestEmailCodeBody {
  studentNumber: string;
  email: string;
}

export function registerPublicRoutes(app: FastifyInstance, db: Db): void {
  const applicationIpLimit = createRequestRateLimitHook(app, {
    max: 300,
    timeWindow: '15 minutes',
    keyGenerator: (request) => `application-ip:${request.ip}`,
  });
  const applicationIdentifierLimit = createRequestRateLimitHook(app, {
    max: 5,
    timeWindow: '15 minutes',
    keyGenerator: (request) => {
      const body = request.body as Partial<CreateApplicationBody> | undefined;
      return `application-student:${body?.studentNumber?.trim() ?? 'invalid'}`;
    },
  });
  const emailCodeIpLimit = createRequestRateLimitHook(app, {
    max: 10,
    timeWindow: '15 minutes',
    keyGenerator: (request) => 'registration-email-ip:' + request.ip,
  });
  const emailCodeTargetLimit = createRequestRateLimitHook(app, {
    max: 4,
    timeWindow: '15 minutes',
    keyGenerator: (request) => {
      const body = request.body as Partial<RequestEmailCodeBody> | undefined;
      return (
        'registration-email-target:' +
        (body?.studentNumber?.trim() ?? 'invalid') +
        ':' +
        (body?.email?.trim().toLowerCase() ?? 'invalid')
      );
    },
  });

  app.post<{ Body: RequestEmailCodeBody }>(
    '/api/public/verifications/email',
    {
      schema: {
        body: {
          type: 'object',
          required: ['studentNumber', 'email'],
          additionalProperties: false,
          properties: {
            studentNumber: { type: 'string', pattern: '^\\d{9}$' },
            email: { type: 'string', minLength: 3, maxLength: 254, format: 'email' },
          },
        },
      },
      preHandler: [emailCodeIpLimit, emailCodeTargetLimit],
    },
    async (request, reply) => {
      const studentNumber = request.body.studentNumber.trim();
      const email = request.body.email.trim().toLowerCase();
      const round = getActiveRound(db);
      if (applyPhase(round) !== 'open') throw badRequest('当前不在报名开放时间内');

      const challenge = createEmailChallenge(db, 'registration', studentNumber, email);
      try {
        const delivered = await sendVerificationEmail(email, challenge.code, 'registration');
        if (!delivered && config.isProduction) throw new Error('SMTP 未配置');
        return reply.code(202).send({
          verificationId: challenge.id,
          expiresAt: challenge.expiresAt,
          message: '验证码已发送，请检查邮箱',
          ...(delivered || config.isProduction ? {} : { devCode: challenge.code }),
        });
      } catch (error) {
        removeEmailChallenge(db, challenge.id);
        request.log.error({ err: error }, 'registration verification email failed');
        throw serviceUnavailable('验证码邮件暂时无法发送，请稍后再试');
      }
    },
  );

  app.get('/api/public/meta', async () => {
    const round = getActiveRound(db);
    const slots = listSlotsWithBooked(db, round.id)
      .filter((slot) => slot.isEnabled === 1 && slot.remaining > 0)
      .map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        capacity: slot.capacity,
        booked: slot.booked,
        remaining: slot.remaining,
        available: true,
      }));

    return {
      round: {
        id: round.id,
        title: round.title,
        description: round.description,
        applyStartAt: round.applyStartAt,
        applyEndAt: round.applyEndAt,
        isOpen: round.isOpen === 1,
        applyPhase: applyPhase(round),
      },
      slots,
    };
  });

  app.post<{ Body: CreateApplicationBody }>(
    '/api/public/applications',
    {
      schema: { body: createApplicationBody },
      preHandler: [applicationIpLimit, applicationIdentifierLimit],
    },
    async (request, reply) => {
      const body = request.body;
      const name = body.name.trim();
      const studentNumber = body.studentNumber.trim();
      const gender = body.gender;
      const college = body.college;
      const email = body.email.trim().toLowerCase();
      const phone = body.phone.trim();
      const password = body.password;

      if (!name) throw badRequest('姓名不能为空');
      if (!/^\d{9}$/.test(studentNumber)) throw badRequest('学号应为 9 位数字');
      if (!['male', 'female'].includes(gender)) throw badRequest('请选择有效的性别');
      if (!(COLLEGE_VALUES as readonly string[]).includes(college)) throw badRequest('请选择有效的学院');
      if (!/^1[3-9]\d{9}$/.test(phone)) throw badRequest('手机号格式不正确');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('邮箱格式不正确');
      if (!isCandidatePasswordValid(password)) throw badRequest('密码需为 8–32 位，并同时包含英文字母和数字');
      const emailChallenge = verifyEmailChallenge(db, {
        id: body.emailVerificationId,
        purpose: 'registration',
        studentNumber,
        email,
        code: body.emailVerificationCode,
      });

      const answers: Record<string, string> = {};
      for (const [key, value] of Object.entries(body.answers)) {
        const text = String(value ?? '').trim();
        if (!text) throw badRequest(`请完整填写问题「${key}」的答案`);
        if (text.length > 2000) throw badRequest(`问题「${key}」的答案过长（最多 2000 字）`);
        answers[key] = text;
      }

      const created = await createApplication(db, {
        roundId: body.roundId,
        name,
        studentNumber,
        gender,
        college,
        email,
        phone,
        password,
        slotId: body.slotId,
        answers,
        emailChallenge,
        canCommit: () => !reply.sent && !reply.raw.destroyed,
      });

      return reply.code(201).send({
        applicationId: created.id,
        message: '报名成功，请使用学号和密码登录“我的报名”查看进度',
      });
    },
  );
}
