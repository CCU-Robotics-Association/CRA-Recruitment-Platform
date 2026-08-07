/**
 * 密码哈希：Node 内置 scrypt（无原生依赖，安全强度可调）。
 * 存储格式：scrypt$N$r$p$saltB64$hashB64
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;
const PREFIX = 'scrypt';

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN);
  const derived = scryptSync(plain, salt, KEY_LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `${PREFIX}$${N}$${R}$${P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const n = Number.parseInt(nStr ?? '', 10);
  const r = Number.parseInt(rStr ?? '', 10);
  const p = Number.parseInt(pStr ?? '', 10);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltB64 ?? '', 'base64');
    expected = Buffer.from(hashB64 ?? '', 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = scryptSync(plain, salt, expected.length, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(derived, expected);
}
