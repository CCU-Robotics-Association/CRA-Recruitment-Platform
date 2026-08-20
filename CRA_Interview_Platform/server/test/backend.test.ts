import test from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../src/lib/db.ts';
import { openDatabase } from '../src/lib/db.ts';
import { migrate } from '../src/db/migrate.ts';
import { assertDatabaseIntegrity, checkDatabaseReadiness } from '../src/lib/health.ts';
import { createApplication } from '../src/services/applicationService.ts';
import { toCsv } from '../src/lib/csv.ts';
import { buildApp } from '../src/app.ts';
import { hashPassword, isCandidatePasswordValid } from '../src/lib/password.ts';
import { generateSlots, shiftRoundSlots } from '../src/services/slotService.ts';

function createTestDatabase(capacity = 4): { db: Db; roundId: number; slotId: number } {
  const db = openDatabase(':memory:');
  migrate(db);
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
     VALUES (99, 'test-admin', 'test-only', '测试管理员', 'super_admin', 1, ?, ?)`,
  ).run(createdAt, createdAt);
  const round = db.prepare(
    `INSERT INTO recruitment_rounds
       (title, description, apply_start_at, apply_end_at, interview_start_at, interview_end_at, is_open, created_at, updated_at)
     VALUES ('test', '', ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    new Date(now - 60_000).toISOString(),
    new Date(now + 86_400_000).toISOString(),
    new Date(now + 172_800_000).toISOString(),
    new Date(now + 176_400_000).toISOString(),
    createdAt,
    createdAt,
  );
  const roundId = Number(round.lastInsertRowid);
  const slot = db.prepare(
    `INSERT INTO interview_slots (round_id, starts_at, ends_at, capacity, is_enabled, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
  ).run(
    roundId,
    new Date(now + 172_800_000).toISOString(),
    new Date(now + 173_700_000).toISOString(),
    capacity,
    createdAt,
  );
  return { db, roundId, slotId: Number(slot.lastInsertRowid) };
}

function applicationInput(roundId: number, slotId: number, index: number) {
  return {
    roundId,
    slotId,
    name: `候选人${index}`,
    studentNumber: String(100_000_000 + index),
    gender: 'male' as const,
    college: '计算机科学技术学院' as const,
    email: `candidate${index}@example.com`,
    phone: String(13_800_000_000 + index),
    password: 'Secure123',
    answers: { placeholderQuestion1: '占位' },
  };
}

async function withEmailVerification<T extends { studentNumber: string; email: string }>(
  app: FastifyInstance,
  payload: T,
): Promise<T & { emailVerificationId: string; emailVerificationCode: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/public/verifications/email',
    payload: { studentNumber: payload.studentNumber, email: payload.email },
  });
  assert.equal(response.statusCode, 202);
  const body = response.json() as { verificationId: string; devCode?: string };
  assert.ok(body.verificationId && body.devCode);
  return {
    ...payload,
    emailVerificationId: body.verificationId,
    emailVerificationCode: body.devCode,
  };
}

test('迁移可重复执行，数据库通过结构和完整性检查', () => {
  const { db } = createTestDatabase();
  try {
    assert.deepEqual(migrate(db).applied, []);
    assert.equal(checkDatabaseReadiness(db).schemaVersion, 14);
    assert.doesNotThrow(() => assertDatabaseIntegrity(db));
  } finally {
    db.close();
  }
});

test('候选人密码限制为 8–32 位，并要求同时包含英文字母和数字', () => {
  assert.equal(isCandidatePasswordValid('Secure12'), true);
  assert.equal(isCandidatePasswordValid(`A1${'x'.repeat(30)}`), true);
  assert.equal(isCandidatePasswordValid('Short1'), false);
  assert.equal(isCandidatePasswordValid(`A1${'x'.repeat(31)}`), false);
  assert.equal(isCandidatePasswordValid('abcdefgh'), false);
  assert.equal(isCandidatePasswordValid('12345678'), false);
});

test('已应用迁移的源码校验和不一致时拒绝继续启动', () => {
  const { db } = createTestDatabase();
  try {
    db.prepare("UPDATE schema_migrations SET checksum = 'tampered' WHERE version = 1").run();
    assert.throws(() => migrate(db), /校验和与源码不一致/);
  } finally {
    db.close();
  }
});

test('并发争抢同一时段不会超过容量', async () => {
  const { db, roundId, slotId } = createTestDatabase(2);
  try {
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) => createApplication(db, applicationInput(roundId, slotId, index))),
    );
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 2);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 3);
    const count = db.prepare('SELECT COUNT(*) AS c FROM applications WHERE slot_id = ?').get(slotId) as { c: number };
    assert.equal(count.c, 2);
  } finally {
    db.close();
  }
});

test('数据库层拒绝超额报名和跨轮次时段关联', async () => {
  const { db, roundId, slotId } = createTestDatabase(1);
  try {
    await createApplication(db, applicationInput(roundId, slotId, 10));
    const now = new Date().toISOString();
    assert.throws(
      () => db.prepare(
        `INSERT INTO applications
           (round_id, slot_id, name, student_number, gender, college, email, phone, answers, query_code, status, created_at, updated_at)
         VALUES (?, ?, '超额', '300000001', 'male', '计算机科学技术学院', 'overflow@example.com', '13820000001', '{}', 'overflow', 'submitted', ?, ?)`,
      ).run(roundId, slotId, now, now),
      /capacity exceeded/,
    );

    const otherRound = db.prepare(
      `INSERT INTO recruitment_rounds
         (title, description, apply_start_at, apply_end_at, is_open, created_at, updated_at)
       VALUES ('other', '', ?, ?, 0, ?, ?)`,
    ).run(new Date(Date.now() - 60_000).toISOString(), new Date(Date.now() + 60_000).toISOString(), now, now);
    const unbookedSlot = db.prepare(
      `INSERT INTO interview_slots (round_id, starts_at, ends_at, capacity, is_enabled, created_at)
       VALUES (?, ?, ?, 1, 1, ?)`,
    ).run(roundId, new Date(Date.now() + 200_000_000).toISOString(), new Date(Date.now() + 200_900_000).toISOString(), now);
    assert.throws(
      () => db.prepare(
        `INSERT INTO applications
           (round_id, slot_id, name, student_number, gender, college, email, phone, answers, query_code, status, created_at, updated_at)
         VALUES (?, ?, '跨轮次', '300000002', 'female', '电子信息工程学院', 'cross@example.com', '13820000002', '{}', 'cross-round', 'submitted', ?, ?)`,
      ).run(Number(otherRound.lastInsertRowid), Number(unbookedSlot.lastInsertRowid), now, now),
      /slot is invalid/,
    );
  } finally {
    db.close();
  }
});

test('数据库层拒绝报名审核和面试管理写入', async () => {
  const { db, roundId, slotId } = createTestDatabase(1);
  try {
    const application = await createApplication(db, applicationInput(roundId, slotId, 20));
    assert.throws(
      () => db.prepare("UPDATE applications SET status = 'approved' WHERE id = ?").run(application.id),
      /application review is disabled/,
    );
    const stored = db.prepare('SELECT status FROM applications WHERE id = ?').get(application.id) as { status: string };
    assert.equal(stored.status, 'submitted');
    assert.throws(
      () => db.prepare(
        `INSERT INTO interviews (application_id, status, created_at, updated_at)
         VALUES (?, 'pending', ?, ?)`,
      ).run(application.id, new Date().toISOString(), new Date().toISOString()),
      /interview management is disabled/,
    );
  } finally {
    db.close();
  }
});

test('CSV 导出会中和可能被表格软件执行的公式', () => {
  const csv = toCsv(['姓名', '内容'], [['测试', '=HYPERLINK("https://example.com")'], ['测试2', '+1+1']]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'\+1\+1/);
});

test('时段生成拒绝不存在的日期和过大的同步任务', () => {
  const { db, roundId } = createTestDatabase();
  try {
    const base = {
      roundId,
      startTime: '09:00',
      endTime: '12:00',
      durationMinutes: 15,
      capacity: 1,
      excludeWeekends: false,
    };
    assert.throws(
      () => generateSlots(db, { ...base, startDate: '2026-02-30', endDate: '2026-03-01' }, 99, '测试管理员'),
      /无效日历日期/,
    );
    assert.throws(
      () => generateSlots(db, { ...base, startDate: '2026-01-01', endDate: '2028-01-01' }, 99, '测试管理员'),
      /366 天/,
    );
  } finally {
    db.close();
  }
});

test('整轮时段可原子平移，已报名关联、容量和时段 ID 保持不变', async () => {
  const { db, roundId, slotId } = createTestDatabase(2);
  try {
    const first = db
      .prepare('SELECT id, starts_at, ends_at, capacity, is_enabled FROM interview_slots WHERE id = ?')
      .get(slotId) as { id: number; starts_at: string; ends_at: string; capacity: number; is_enabled: number };
    const durationMs = Date.parse(first.ends_at) - Date.parse(first.starts_at);
    const secondInfo = db.prepare(
      `INSERT INTO interview_slots (round_id, starts_at, ends_at, capacity, is_enabled, created_at)
       VALUES (?, ?, ?, 3, 0, ?)`,
    ).run(
      roundId,
      first.ends_at,
      new Date(Date.parse(first.ends_at) + durationMs).toISOString(),
      new Date().toISOString(),
    );
    const secondId = Number(secondInfo.lastInsertRowid);
    const application = await createApplication(db, applicationInput(roundId, slotId, 40));

    // 新首时段恰好等于第二个时段的旧开始时间，验证两阶段更新不会触发唯一键冲突。
    const result = shiftRoundSlots(db, roundId, first.ends_at, 99, '测试管理员');
    assert.equal(result.shifted, 2);
    assert.equal(result.deltaMinutes, durationMs / 60_000);

    const shifted = db
      .prepare('SELECT id, starts_at, ends_at, capacity, is_enabled FROM interview_slots WHERE round_id = ? ORDER BY starts_at')
      .all(roundId) as Array<{ id: number; starts_at: string; ends_at: string; capacity: number; is_enabled: number }>;
    assert.deepEqual(shifted.map((slot) => slot.id), [slotId, secondId]);
    assert.equal(shifted[0]?.starts_at, first.ends_at);
    assert.equal(shifted[0]?.capacity, 2);
    assert.equal(shifted[0]?.is_enabled, 1);
    assert.equal(shifted[1]?.capacity, 3);
    assert.equal(shifted[1]?.is_enabled, 0);
    const storedApplication = db.prepare('SELECT slot_id FROM applications WHERE id = ?').get(application.id) as { slot_id: number };
    assert.equal(storedApplication.slot_id, slotId);

    const round = db
      .prepare('SELECT interview_start_at, interview_end_at FROM recruitment_rounds WHERE id = ?')
      .get(roundId) as { interview_start_at: string; interview_end_at: string };
    assert.equal(round.interview_start_at, result.firstStartsAt);
    assert.equal(round.interview_end_at, result.lastEndsAt);
    const audit = db
      .prepare("SELECT action FROM audit_logs WHERE entity = 'recruitment_round' AND entity_id = ? ORDER BY id DESC LIMIT 1")
      .get(roundId) as { action: string };
    assert.equal(audit.action, 'slots_shift');
  } finally {
    db.close();
  }
});

test('HTTP 存活/就绪检查验证真实数据库，并为响应附加追踪 ID', async () => {
  const { app } = await buildApp({ dbPath: ':memory:', logger: false });
  try {
    const live = await app.inject({ method: 'GET', url: '/api/health/live' });
    assert.equal(live.statusCode, 200);
    assert.equal(live.json().status, 'alive');
    assert.ok(live.headers['x-request-id']);

    const ready = await app.inject({ method: 'GET', url: '/api/health/ready' });
    assert.equal(ready.statusCode, 200);
    assert.equal(ready.json().database, 'ok');
    assert.equal(ready.json().schemaVersion, 14);

    const crossSite = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      headers: { origin: 'https://evil.example' },
      payload: { username: 'admin', password: 'wrong-password' },
    });
    assert.equal(crossSite.statusCode, 403);
  } finally {
    await app.close();
  }
});

test('公开时段接口只返回仍有名额且已启用的真实数字时段', async () => {
  const { app, db } = await buildApp({ dbPath: ':memory:', logger: false });
  try {
    const round = db.prepare('SELECT id FROM recruitment_rounds ORDER BY id LIMIT 1').get() as { id: number };
    const available = db
      .prepare('SELECT id FROM interview_slots WHERE round_id = ? ORDER BY id LIMIT 2')
      .all(round.id) as Array<{ id: number }>;
    assert.equal(available.length, 2);
    const [fullSlot, disabledSlot] = available;
    assert.ok(fullSlot && disabledSlot);
    db.prepare('UPDATE interview_slots SET capacity = 1 WHERE id = ?').run(fullSlot.id);
    await createApplication(db, applicationInput(round.id, fullSlot.id, 90));
    db.prepare('UPDATE interview_slots SET is_enabled = 0 WHERE id = ?').run(disabledSlot.id);

    const response = await app.inject({ method: 'GET', url: '/api/public/meta' });
    assert.equal(response.statusCode, 200);
    const returnedSlots = response.json().slots as Array<{ id: number; available: boolean; remaining: number }>;
    assert.equal(returnedSlots.some((slot) => slot.id === fullSlot.id), false);
    assert.equal(returnedSlots.some((slot) => slot.id === disabledSlot.id), false);
    assert.equal(returnedSlots.every((slot) => Number.isInteger(slot.id) && slot.available && slot.remaining > 0), true);
  } finally {
    await app.close();
  }
});

test('真实 HTTP 报名和登录不会把已读取完成的请求误判为客户端中断', async () => {
  const { app, db } = await buildApp({ dbPath: ':memory:', logger: false });
  try {
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    assert.ok(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`;
    const slot = db.prepare('SELECT id FROM interview_slots ORDER BY id LIMIT 1').get() as { id: number };
    const verification = await fetch(origin + '/api/public/verifications/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        studentNumber: '588888888',
        email: 'network-regression@example.com',
      }),
    });
    assert.equal(verification.status, 202);
    const verificationBody = (await verification.json()) as {
      verificationId: string;
      devCode: string;
    };

    const registration = await fetch(`${origin}/api/public/applications`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '真实网络回归',
        studentNumber: '588888888',
        gender: 'male',
        college: '计算机科学技术学院',
        email: 'network-regression@example.com',
        phone: '13858888888',
        password: 'Network123',
        emailVerificationId: verificationBody.verificationId,
        emailVerificationCode: verificationBody.devCode,
        slotId: slot.id,
        answers: { placeholderQuestion1: '占位' },
      }),
    });
    assert.equal(registration.status, 201);

    const login = await fetch(`${origin}/api/user/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentNumber: '588888888', password: 'Network123' }),
    });
    assert.equal(login.status, 200);
  } finally {
    await app.close();
  }
});

test('候选人可在报名期内修改完整资料，截止后由后端强制锁定', async () => {
  const { app, db } = await buildApp({ dbPath: ':memory:', logger: false });
  try {
    const slots = db
      .prepare('SELECT id FROM interview_slots ORDER BY id LIMIT 2')
      .all() as Array<{ id: number }>;
    assert.equal(slots.length, 2);
    const [firstSlot, secondSlot] = slots;
    assert.ok(firstSlot && secondSlot);

    const registration = await app.inject({
      method: 'POST',
      url: '/api/public/applications',
      payload: await withEmailVerification(app, {
        name: '编辑前姓名',
        studentNumber: '577777777',
        gender: 'male',
        college: '计算机科学技术学院',
        email: 'before-edit@example.com',
        phone: '13857777777',
        password: 'Editable123',
        slotId: firstSlot.id,
        answers: {
          placeholderQuestion1: '原答案一',
          placeholderQuestion2: '原答案二',
          placeholderQuestion3: '原答案三',
        },
      }),
    });
    assert.equal(registration.statusCode, 201);

    const before = db
      .prepare('SELECT id, password_hash FROM applications WHERE student_number = ?')
      .get('577777777') as { id: number; password_hash: string };
    const login = await app.inject({
      method: 'POST',
      url: '/api/user/auth/login',
      payload: { studentNumber: '577777777', password: 'Editable123' },
    });
    assert.equal(login.statusCode, 200);
    const setCookie = login.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0];
    const csrfToken = (login.json() as { csrfToken: string }).csrfToken;
    assert.ok(cookie && csrfToken);
    const authHeaders = { cookie, 'x-csrf-token': csrfToken };

    const overview = await app.inject({ method: 'GET', url: '/api/user/me', headers: authHeaders });
    assert.equal(overview.statusCode, 200);
    assert.equal(Object.hasOwn(overview.json(), 'interview'), false);
    assert.equal(Object.hasOwn(overview.json(), 'resultVisible'), false);
    assert.equal(Object.hasOwn(overview.json().application, 'status'), false);
    assert.equal(Object.hasOwn(overview.json().application, 'statusLabel'), false);

    const slotResponse = await app.inject({ method: 'GET', url: '/api/user/me/slots', headers: authHeaders });
    assert.equal(slotResponse.statusCode, 200);
    assert.equal(slotResponse.json().editable, true);
    assert.equal(slotResponse.json().slots.some((slot: { id: number }) => slot.id === secondSlot.id), true);

    const updatedPayload = {
      name: '编辑后姓名',
      gender: 'female',
      college: '数学与统计学院',
      email: 'after-edit@example.com',
      phone: '13856666666',
      slotId: secondSlot.id,
      answers: {
        placeholderQuestion1: '新答案一',
        placeholderQuestion2: '新答案二',
        placeholderQuestion3: '新答案三',
      },
    };
    const unverifiedEmailChange = await app.inject({
      method: 'PUT',
      url: '/api/user/me',
      headers: authHeaders,
      payload: updatedPayload,
    });
    assert.equal(unverifiedEmailChange.statusCode, 400);

    const emailVerification = await app.inject({
      method: 'POST',
      url: '/api/public/verifications/email',
      payload: { studentNumber: '577777777', email: updatedPayload.email },
    });
    assert.equal(emailVerification.statusCode, 202);
    const emailVerificationBody = emailVerification.json() as {
      verificationId: string;
      devCode: string;
    };
    const verifiedUpdatedPayload = {
      ...updatedPayload,
      emailVerificationId: emailVerificationBody.verificationId,
      emailVerificationCode: emailVerificationBody.devCode,
    };
    const updated = await app.inject({
      method: 'PUT',
      url: '/api/user/me',
      headers: authHeaders,
      payload: verifiedUpdatedPayload,
    });
    assert.equal(updated.statusCode, 200);
    const updatedBody = updated.json();
    assert.equal(updatedBody.application.name, '编辑后姓名');
    assert.equal(updatedBody.application.studentNumber, '577777777');
    assert.equal(updatedBody.application.slot.id, secondSlot.id);
    assert.deepEqual(updatedBody.application.answers, updatedPayload.answers);

    const stored = db
      .prepare('SELECT student_number, password_hash, name, gender, college, email, phone, slot_id, answers FROM applications WHERE id = ?')
      .get(before.id) as Record<string, unknown>;
    assert.equal(stored.student_number, '577777777');
    assert.equal(stored.password_hash, before.password_hash);
    assert.equal(stored.name, '编辑后姓名');
    assert.equal(stored.gender, 'female');
    assert.equal(stored.college, '数学与统计学院');
    assert.equal(stored.email, 'after-edit@example.com');
    assert.equal(stored.phone, '13856666666');
    assert.equal(stored.slot_id, secondSlot.id);
    assert.deepEqual(JSON.parse(String(stored.answers)), updatedPayload.answers);
    const audit = db
      .prepare("SELECT action FROM audit_logs WHERE entity = 'application' AND entity_id = ? ORDER BY id DESC LIMIT 1")
      .get(before.id) as { action: string };
    assert.equal(audit.action, 'candidate_application_update');

    const identityTamper = await app.inject({
      method: 'PUT',
      url: '/api/user/me',
      headers: authHeaders,
      payload: { ...updatedPayload, studentNumber: '500000000' },
    });
    assert.equal(identityTamper.statusCode, 200);
    assert.equal(identityTamper.json().application.studentNumber, '577777777');
    assert.equal(
      (db.prepare('SELECT student_number FROM applications WHERE id = ?').get(before.id) as { student_number: string }).student_number,
      '577777777',
    );

    db.prepare('UPDATE recruitment_rounds SET apply_end_at = ? WHERE id = ?').run(
      new Date(Date.now() - 60_000).toISOString(),
      updatedBody.application.round.id,
    );
    const locked = await app.inject({
      method: 'PUT',
      url: '/api/user/me',
      headers: authHeaders,
      payload: { ...updatedPayload, name: '不应写入' },
    });
    assert.equal(locked.statusCode, 409);
    assert.equal(
      (db.prepare('SELECT name FROM applications WHERE id = ?').get(before.id) as { name: string }).name,
      '编辑后姓名',
    );
  } finally {
    await app.close();
  }
});

test('报名接口不再需要班级、专业和年级，并拒绝其他性别或名单外学院', async () => {
  const { app, db } = await buildApp({ dbPath: ':memory:', logger: false });
  try {
    const slot = db.prepare('SELECT id FROM interview_slots ORDER BY id LIMIT 1').get() as { id: number };
    db.prepare('UPDATE interview_slots SET capacity = 3 WHERE id = ?').run(slot.id);
    const payload = {
      name: '规则测试',
      studentNumber: '400000001',
      gender: 'female',
      college: '数学与统计学院',
      email: 'profile-rule@example.com',
      phone: '13830000001',
      password: 'Profile123',
      slotId: slot.id,
      answers: { placeholderQuestion1: '占位' },
    };
    const verifiedPayload = await withEmailVerification(app, payload);
    const accepted = await app.inject({ method: 'POST', url: '/api/public/applications', payload: verifiedPayload });
    assert.equal(accepted.statusCode, 201);
    const stored = db.prepare('SELECT class_name, major, grade FROM applications WHERE student_number = ?').get('400000001') as {
      class_name: string | null;
      major: string | null;
      grade: string | null;
    };
    assert.equal(stored.class_name, null);
    assert.equal(stored.major, null);
    assert.equal(stored.grade, null);

    const otherGender = await app.inject({
      method: 'POST',
      url: '/api/public/applications',
      payload: { ...verifiedPayload, studentNumber: '400000002', email: 'other@example.com', phone: '13830000002', gender: 'other' },
    });
    assert.equal(otherGender.statusCode, 400);

    const unknownCollege = await app.inject({
      method: 'POST',
      url: '/api/public/applications',
      payload: { ...verifiedPayload, studentNumber: '400000003', email: 'college@example.com', phone: '13830000003', college: '其他学院' },
    });
    assert.equal(unknownCollege.statusCode, 400);

    const overlyLongPassword = await app.inject({
      method: 'POST',
      url: '/api/public/applications',
      payload: {
        ...verifiedPayload,
        studentNumber: '400000004',
        email: 'password-length@example.com',
        phone: '13830000004',
        password: `A1${'x'.repeat(31)}`,
      },
    });
    assert.equal(overlyLongPassword.statusCode, 400);
  } finally {
    await app.close();
  }
});

test('邮箱验证码一次性消费，候选人可自助重置密码并注销旧会话', async () => {
  const { app, db } = await buildApp({ dbPath: ':memory:', logger: false });
  try {
    const slot = db.prepare('SELECT id FROM interview_slots ORDER BY id LIMIT 1').get() as { id: number };
    const base = {
      name: '验证码测试',
      studentNumber: '466666666',
      gender: 'male',
      college: '计算机科学技术学院',
      email: 'verification@example.com',
      phone: '13836666666',
      password: 'BeforeReset123',
      slotId: slot.id,
      answers: { placeholderQuestion1: '占位' },
    };
    const verified = await withEmailVerification(app, base);
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/public/applications',
      payload: { ...verified, emailVerificationCode: '000000' },
    });
    assert.equal(wrong.statusCode, 400);

    const registered = await app.inject({
      method: 'POST',
      url: '/api/public/applications',
      payload: verified,
    });
    assert.equal(registered.statusCode, 201);
    const replay = await app.inject({
      method: 'POST',
      url: '/api/public/applications',
      payload: { ...verified, phone: '13836666667' },
    });
    assert.equal(replay.statusCode, 400);

    const resetRequest = await app.inject({
      method: 'POST',
      url: '/api/user/auth/password-reset/request',
      payload: { studentNumber: base.studentNumber, email: base.email },
    });
    assert.equal(resetRequest.statusCode, 202);
    const resetChallenge = resetRequest.json() as { verificationId: string; devCode: string };
    assert.ok(resetChallenge.verificationId && resetChallenge.devCode);

    const reset = await app.inject({
      method: 'POST',
      url: '/api/user/auth/password-reset/confirm',
      payload: {
        studentNumber: base.studentNumber,
        email: base.email,
        verificationId: resetChallenge.verificationId,
        verificationCode: resetChallenge.devCode,
        newPassword: 'AfterReset456',
      },
    });
    assert.equal(reset.statusCode, 200);
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/user/auth/login',
      payload: { studentNumber: base.studentNumber, password: base.password },
    });
    assert.equal(oldLogin.statusCode, 401);
    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/user/auth/login',
      payload: { studentNumber: base.studentNumber, password: 'AfterReset456' },
    });
    assert.equal(newLogin.statusCode, 200);
    const audit = db
      .prepare("SELECT action FROM audit_logs WHERE entity = 'application' ORDER BY id DESC LIMIT 1")
      .get() as { action: string };
    assert.equal(audit.action, 'candidate_password_reset');
  } finally {
    await app.close();
  }
});

test('只读查看员不能删除报名，旧审核和面试接口不存在，非法轮次日期返回 400', async () => {
  const { app, db } = await buildApp({ dbPath: ':memory:', logger: false });
  try {
    const now = new Date().toISOString();
    const reviewerHash = await hashPassword('Reviewer123');
    db.prepare(
      `INSERT INTO users (username, password_hash, display_name, role, is_active, created_at, updated_at)
       VALUES ('reviewer-test', ?, '只读查看员', 'reviewer', 1, ?, ?)`,
    ).run(reviewerHash, now, now);

    const reviewerLogin = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { username: 'reviewer-test', password: 'Reviewer123' },
    });
    assert.equal(reviewerLogin.statusCode, 200);
    const reviewerCookie = String(reviewerLogin.headers['set-cookie']).split(';')[0];
    const reviewerCsrf = reviewerLogin.json().csrfToken as string;
    const forbiddenDelete = await app.inject({
      method: 'DELETE',
      url: '/api/admin/applications/999999',
      headers: { cookie: reviewerCookie, 'x-csrf-token': reviewerCsrf },
    });
    assert.equal(forbiddenDelete.statusCode, 403);

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { username: 'admin', password: 'admin123456' },
    });
    assert.equal(adminLogin.statusCode, 200);
    const adminCookie = String(adminLogin.headers['set-cookie']).split(';')[0];
    const adminCsrf = adminLogin.json().csrfToken as string;
    const activeSlot = db
      .prepare('SELECT round_id, id FROM interview_slots ORDER BY id LIMIT 1')
      .get() as { round_id: number; id: number };
    await createApplication(db, applicationInput(activeSlot.round_id, activeSlot.id, 98));
    const currentFirstSlot = db
      .prepare('SELECT starts_at FROM interview_slots WHERE round_id = ? ORDER BY starts_at, id LIMIT 1')
      .get(activeSlot.round_id) as { starts_at: string };
    const shiftResponse = await app.inject({
      method: 'PUT',
      url: `/api/admin/rounds/${activeSlot.round_id}/shift-slots`,
      headers: { cookie: adminCookie, 'x-csrf-token': adminCsrf },
      payload: { firstSlotStartsAt: new Date(Date.parse(currentFirstSlot.starts_at) + 60_000).toISOString() },
    });
    assert.equal(shiftResponse.statusCode, 200);
    assert.equal(shiftResponse.json().shifted > 0, true);
    const applicationList = await app.inject({
      method: 'GET',
      url: '/api/admin/applications',
      headers: { cookie: adminCookie },
    });
    assert.equal(applicationList.statusCode, 200);
    const firstApplication = applicationList.json().items[0] as Record<string, unknown>;
    for (const removedField of ['status', 'reviewNote', 'reviewedBy', 'reviewedAt', 'reviewedByName']) {
      assert.equal(Object.hasOwn(firstApplication, removedField), false);
    }
    const overview = await app.inject({
      method: 'GET',
      url: '/api/admin/stats/overview',
      headers: { cookie: adminCookie },
    });
    assert.equal(overview.statusCode, 200);
    assert.equal(Object.hasOwn(overview.json(), 'byStatus'), false);
    assert.equal(Object.hasOwn(overview.json().recent[0], 'status'), false);
    const removedReviewRoute = await app.inject({
      method: 'PATCH',
      url: '/api/admin/applications/1/status',
      headers: { cookie: adminCookie, 'x-csrf-token': adminCsrf },
      payload: { status: 'approved' },
    });
    assert.equal(removedReviewRoute.statusCode, 404);
    const removedInterviewRoute = await app.inject({
      method: 'GET',
      url: '/api/admin/interviews',
      headers: { cookie: adminCookie },
    });
    assert.equal(removedInterviewRoute.statusCode, 404);
    const invalidRound = await app.inject({
      method: 'POST',
      url: '/api/admin/rounds',
      headers: { cookie: adminCookie, 'x-csrf-token': adminCsrf },
      payload: { title: '测试轮次', applyStartAt: 'not-a-date', applyEndAt: '2026-09-01' },
    });
    assert.equal(invalidRound.statusCode, 400);
    assert.equal(invalidRound.json().error.code, 'BAD_REQUEST');
  } finally {
    await app.close();
  }
});
