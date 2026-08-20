import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { config } from '../config.ts';
import { AppError, serviceUnavailable } from './errors.ts';

const N = 32768;
const R = 8;
const P = 3;
const KEY_LEN = 64;
const SALT_LEN = 16;
const MAX_MEMORY = 128 * 1024 * 1024;
const PREFIX = 'scrypt';

type ParsedPasswordHash = {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  expected: Buffer;
};

let activePasswordTasks = 0;
const waitingPasswordTasks: Array<() => void> = [];

async function acquirePasswordWorker(): Promise<void> {
  if (activePasswordTasks < config.passwordConcurrency) {
    activePasswordTasks += 1;
    return;
  }
  if (waitingPasswordTasks.length >= config.passwordQueueLimit) {
    throw serviceUnavailable('登录或报名请求过多，请稍后重试');
  }
  await new Promise<void>((resolve) => waitingPasswordTasks.push(resolve));
}

function releasePasswordWorker(): void {
  const next = waitingPasswordTasks.shift();
  if (next) next();
  else activePasswordTasks -= 1;
}

async function runPasswordTask<T>(task: () => Promise<T>): Promise<T> {
  await acquirePasswordWorker();
  try {
    return await task();
  } finally {
    releasePasswordWorker();
  }
}

export function isCandidatePasswordValid(plain: string): boolean {
  return (
    plain.length >= 8 &&
    plain.length <= 32 &&
    /[A-Za-z]/.test(plain) &&
    /\d/.test(plain)
  );
}

function deriveKey(
  plain: string,
  salt: Buffer,
  keyLength: number,
  params: Pick<ParsedPasswordHash, 'n' | 'r' | 'p'>,
): Promise<Buffer> {
  return runPasswordTask(
    () => new Promise((resolve, reject) => {
      scrypt(
        plain,
        salt,
        keyLength,
        { N: params.n, r: params.r, p: params.p, maxmem: MAX_MEMORY },
        (error, derived) => {
          if (error) reject(error);
          else resolve(derived);
        },
      );
    }),
  );
}

function parsePasswordHash(stored: string): ParsedPasswordHash | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return null;

  const [, nText, rText, pText, saltText, hashText] = parts;
  const n = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (
    !Number.isSafeInteger(n) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    n < 2 ||
    n > 1_048_576 ||
    (n & (n - 1)) !== 0 ||
    r < 1 ||
    r > 32 ||
    p < 1 ||
    p > 16
  ) {
    return null;
  }

  try {
    const salt = Buffer.from(saltText ?? '', 'base64');
    const expected = Buffer.from(hashText ?? '', 'base64');
    if (salt.length < 16 || salt.length > 64 || expected.length < 32 || expected.length > 128) {
      return null;
    }
    return { n, r, p, salt, expected };
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await deriveKey(plain, salt, KEY_LEN, { n: N, r: R, p: P });
  return `${PREFIX}$${N}$${R}$${P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;

  try {
    const derived = await deriveKey(plain, parsed.salt, parsed.expected.length, parsed);
    return timingSafeEqual(derived, parsed.expected);
  } catch (error) {
    if (error instanceof AppError) throw error;
    return false;
  }
}

export function needsPasswordRehash(stored: string): boolean {
  const parsed = parsePasswordHash(stored);
  return (
    !parsed ||
    parsed.n !== N ||
    parsed.r !== R ||
    parsed.p !== P ||
    parsed.expected.length !== KEY_LEN
  );
}

let dummyPasswordHash: Promise<string> | undefined;

export function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= hashPassword(randomBytes(32).toString('base64url')).catch((error: unknown) => {
    dummyPasswordHash = undefined;
    throw error;
  });
  return dummyPasswordHash;
}
