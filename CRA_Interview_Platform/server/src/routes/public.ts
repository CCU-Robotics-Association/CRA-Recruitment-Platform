/**
 * 公开 API（候选人侧，无需鉴权）：
 * - GET  /api/public/meta                      报名配置 + 时段（含剩余名额）
 * - POST /api/public/applications              提交报名
 * - GET  /api/public/applications/:queryCode   凭查询码查看自己的报名状态
 */
import type { FastifyInstance } from 'fastify';
import type { Db } from '../lib/db.ts';
import { badRequest } from '../lib/errors.ts';
import { applyPhase, getActiveRound } from '../services/roundService.ts';
import { listSlotsWithBooked } from '../services/slotService.ts';
import { createApplication, getApplicationByQueryCode } from '../services/applicationService.ts';
import { APPLICATION_STATUS_LABELS } from '../types.ts';
import type { ApplicationStatus } from '../types.ts';

const answersSchema = {
  type: 'object',
  minProperties: 1,
  maxProperties: 20,
  additionalProperties: { type: 'string', maxLength: 2000 },
} as const;

const createApplicationBody = {
  type: 'object',
  required: ['name', 'studentNumber', 'email', 'phone', 'slotId', 'answers'],
  additionalProperties: false,
  properties: {
    roundId: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1, maxLength: 64 },
    studentNumber: { type: 'string', pattern: '^\\d{9}$' },
    email: { type: 'string', minLength: 3, maxLength: 254, format: 'email' },
    phone: { type: 'string', pattern: '^1[3-9]\\d{9}$' },
    slotId: { type: 'integer', minimum: 1 },
    answers: answersSchema,
  },
} as const;

interface CreateApplicationBody {
  roundId?: number;
  name: string;
  studentNumber: string;
  email: string;
  phone: string;
  slotId: number;
  answers: Record<string, string>;
}

const publicStatusLabels: Record<ApplicationStatus, string> = APPLICATION_STATUS_LABELS;

export function registerPublicRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/public/meta', async () => {
    const round = getActiveRound(db);
    const slots = listSlotsWithBooked(db, round.id).map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      capacity: s.capacity,
      booked: s.booked,
      remaining: s.remaining,
      available: s.isEnabled === 1 && s.remaining > 0,
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
    { schema: { body: createApplicationBody } },
    async (request, reply) => {
      const body = request.body;
      // 服务端再次归一化（与前端校验规则保持一致，防御绕过）
      const name = body.name.trim();
      const studentNumber = body.studentNumber.trim();
      const email = body.email.trim().toLowerCase();
      const phone = body.phone.trim();
      if (!name) throw badRequest('姓名不能为空');
      if (!/^\d{9}$/.test(studentNumber)) throw badRequest('学号应为 9 位数字');
      if (!/^1[3-9]\d{9}$/.test(phone)) throw badRequest('手机号格式不正确');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('邮箱格式不正确');

      const answers: Record<string, string> = {};
      for (const [key, value] of Object.entries(body.answers)) {
        const text = String(value ?? '').trim();
        if (!text) throw badRequest(`请完整填写问题「${key}」的答案`);
        if (text.length > 2000) throw badRequest(`问题「${key}」的答案过长（最多 2000 字）`);
        answers[key] = text;
      }

      const created = createApplication(db, {
        roundId: body.roundId,
        name,
        studentNumber,
        email,
        phone,
        slotId: body.slotId,
        answers,
      });

      // queryCode 仅在本次响应返回，用于候选人自助查询
      return reply.code(201).send({
        applicationId: created.id,
        queryCode: created.queryCode,
        message: '报名成功，请保存查询码以便查看审核进度',
      });
    },
  );

  app.get<{ Params: { queryCode: string } }>(
    '/api/public/applications/:queryCode',
    { schema: { params: { type: 'object', required: ['queryCode'], properties: { queryCode: { type: 'string', minLength: 16, maxLength: 64 } } } } },
    async (request) => {
      const app = getApplicationByQueryCode(db, request.params.queryCode);
      return {
        id: app.id,
        name: app.name,
        studentNumber: app.studentNumber,
        email: app.email,
        phone: app.phone,
        status: app.status,
        statusLabel: publicStatusLabels[app.status],
        slot: app.slot ?? null,
        answers: app.answers,
        reviewNote: app.reviewNote,
        createdAt: app.createdAt,
      };
    },
  );
}
