import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildApp } from '../src/app.ts';
import { createEmailChallenge } from '../src/services/emailVerificationService.ts';

test('HTTP 基线：100 人并发争抢 50 个名额并完成候选人登录', { timeout: 120_000 }, async (t) => {
  const { app, db } = await buildApp({ dbPath: ':memory:', logger: false });
  try {
    const slot = db.prepare('SELECT id FROM interview_slots ORDER BY id LIMIT 1').get() as { id: number };
    db.prepare('UPDATE interview_slots SET capacity = 50 WHERE id = ?').run(slot.id);

    const applicants = Array.from({ length: 100 }, (_, index) => ({
      index,
      studentNumber: String(200_000_000 + index),
      phone: String(13_810_000_000 + index),
      email: `load-${index}@example.com`,
    }));
    const verifiedApplicants = applicants.map((candidate) => ({
      ...candidate,
      verification: createEmailChallenge(
        db,
        'registration',
        candidate.studentNumber,
        candidate.email,
      ),
    }));
    const applyStartedAt = performance.now();
    const applyResponses = await Promise.all(
      verifiedApplicants.map((candidate) =>
        app.inject({
          method: 'POST',
          url: '/api/public/applications',
          payload: {
            name: `负载测试${candidate.index}`,
            studentNumber: candidate.studentNumber,
            gender: 'male',
            college: '计算机科学技术学院',
            phone: candidate.phone,
            email: candidate.email,
            password: 'LoadTest123',
            emailVerificationId: candidate.verification.id,
            emailVerificationCode: candidate.verification.code,
            slotId: slot.id,
            answers: { placeholderQuestion1: '占位' },
          },
        }),
      ),
    );
    const applyDurationMs = performance.now() - applyStartedAt;
    const accepted = verifiedApplicants.filter((_, index) => applyResponses[index]?.statusCode === 201);
    assert.equal(accepted.length, 50);
    assert.equal(applyResponses.filter((response) => response.statusCode === 409).length, 50);
    const booked = db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ?').get(slot.id) as { c: number };
    assert.equal(booked.c, 50);

    const loginStartedAt = performance.now();
    const loginResponses = await Promise.all(
      accepted.map((candidate) =>
        app.inject({
          method: 'POST',
          url: '/api/user/auth/login',
          payload: { studentNumber: candidate.studentNumber, password: 'LoadTest123' },
        }),
      ),
    );
    const loginDurationMs = performance.now() - loginStartedAt;
    assert.equal(loginResponses.filter((response) => response.statusCode === 200).length, 50);
    t.diagnostic(`100 个并发报名请求：${Math.round(applyDurationMs)}ms；50 个并发登录请求：${Math.round(loginDurationMs)}ms`);
  } finally {
    await app.close();
  }
});
