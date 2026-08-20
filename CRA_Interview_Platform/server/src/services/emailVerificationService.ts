import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config.ts';
import type { Db } from '../lib/db.ts';
import { badRequest, tooMany } from '../lib/errors.ts';
import { nowIso } from '../lib/time.ts';

export type VerificationPurpose = 'registration' | 'password_reset';

interface ChallengeRow {
  id: string;
  purpose: VerificationPurpose;
  target_digest: string;
  code_digest: string;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
}

function targetDigest(purpose: VerificationPurpose, studentNumber: string, email: string): string {
  return createHmac('sha256', config.jwtSecret)
    .update(purpose + '\0' + studentNumber.trim() + '\0' + email.trim().toLowerCase())
    .digest('hex');
}

function codeDigest(id: string, target: string, code: string): string {
  return createHmac('sha256', config.jwtSecret).update(id + '\0' + target + '\0' + code).digest('hex');
}

function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createEmailChallenge(
  db: Db,
  purpose: VerificationPurpose,
  studentNumber: string,
  email: string,
): { id: string; code: string; expiresAt: string } {
  const now = new Date();
  const target = targetDigest(purpose, studentNumber, email);
  const recentCutoff = new Date(now.getTime() - 15 * 60_000).toISOString();
  const recent = Number(
    (
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM email_verification_challenges WHERE purpose = ? AND target_digest = ? AND created_at >= ?',
        )
        .get(purpose, target, recentCutoff) as { count: number }
    ).count,
  );
  if (recent >= 3) throw tooMany('验证码发送过于频繁，请 15 分钟后再试');

  db.prepare('DELETE FROM email_verification_challenges WHERE created_at < ?').run(
    new Date(now.getTime() - 48 * 60 * 60_000).toISOString(),
  );
  db.prepare(
    'UPDATE email_verification_challenges SET consumed_at = ? WHERE purpose = ? AND target_digest = ? AND consumed_at IS NULL',
  ).run(now.toISOString(), purpose, target);

  const id = randomUUID();
  const code = String(randomInt(100_000, 1_000_000));
  const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
  db.prepare(
    'INSERT INTO email_verification_challenges (id, purpose, target_digest, code_digest, attempts, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, 0, ?, NULL, ?)',
  ).run(id, purpose, target, codeDigest(id, target, code), expiresAt, now.toISOString());
  return { id, code, expiresAt };
}

export function removeEmailChallenge(db: Db, id: string): void {
  db.prepare('DELETE FROM email_verification_challenges WHERE id = ?').run(id);
}

export function verifyEmailChallenge(
  db: Db,
  input: {
    id: string;
    purpose: VerificationPurpose;
    studentNumber: string;
    email: string;
    code: string;
  },
): { id: string; targetDigest: string } {
  const row = db
    .prepare(
      'SELECT id, purpose, target_digest, code_digest, attempts, expires_at, consumed_at FROM email_verification_challenges WHERE id = ?',
    )
    .get(input.id) as ChallengeRow | undefined;
  const target = targetDigest(input.purpose, input.studentNumber, input.email);
  const invalid =
    !row ||
    row.purpose !== input.purpose ||
    row.target_digest !== target ||
    row.consumed_at !== null ||
    row.attempts >= 5 ||
    Date.parse(row.expires_at) <= Date.now() ||
    !safeEqualHex(row.code_digest, codeDigest(input.id, target, input.code));

  if (invalid) {
    if (row && row.consumed_at === null && row.attempts < 8) {
      db.prepare('UPDATE email_verification_challenges SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    }
    throw badRequest('验证码无效或已过期，请重新获取');
  }
  return { id: row.id, targetDigest: target };
}

export function consumeEmailChallenge(
  db: Db,
  challenge: { id: string; targetDigest: string },
  purpose: VerificationPurpose,
): void {
  const result = db
    .prepare(
      'UPDATE email_verification_challenges SET consumed_at = ? WHERE id = ? AND purpose = ? AND target_digest = ? AND consumed_at IS NULL AND expires_at > ?',
    )
    .run(nowIso(), challenge.id, purpose, challenge.targetDigest, nowIso());
  if (Number(result.changes) !== 1) throw badRequest('验证码已使用或已过期，请重新获取');
}
