import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.ts';
import { forbidden } from './errors.ts';

export const ADMIN_SESSION_COOKIE = 'cra_admin_session';
export const CANDIDATE_SESSION_COOKIE = 'cra_candidate_session';

type SessionKind = 'admin' | 'candidate';

function cookieName(kind: SessionKind): string {
  return kind === 'admin' ? ADMIN_SESSION_COOKIE : CANDIDATE_SESSION_COOKIE;
}

function cookiePath(kind: SessionKind): string {
  return kind === 'admin' ? '/api/admin' : '/api/user';
}

export function createCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function setSessionCookie(reply: FastifyReply, kind: SessionKind, token: string): void {
  reply.setCookie(cookieName(kind), token, {
    path: cookiePath(kind),
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    maxAge: config.jwtExpiresInSeconds,
    priority: 'high',
  });
}

export function clearSessionCookie(reply: FastifyReply, kind: SessionKind): void {
  reply.clearCookie(cookieName(kind), {
    path: cookiePath(kind),
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
  });
}

export function readSessionCookie(request: FastifyRequest, kind: SessionKind): string | undefined {
  return request.cookies[cookieName(kind)];
}

export function verifyCsrf(request: FastifyRequest, expectedToken: string): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;

  const header = request.headers['x-csrf-token'];
  const suppliedToken = Array.isArray(header) ? header[0] : header;
  if (!suppliedToken) throw forbidden('请求验证失败，请刷新页面后重试');

  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw forbidden('请求验证失败，请刷新页面后重试');
  }
}
