import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from './db.ts';
import { forbidden, unauthorized } from './errors.ts';
import {
  clearSessionCookie,
  readSessionCookie,
  verifyCsrf,
} from './session.ts';
import type { UserRole } from '../types.ts';

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  csrfToken: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub?: number;
      tv?: number;
      kind?: 'admin' | 'user';
      csrf?: string;
    };
    user: AuthUser;
  }
}

export interface AuthTokenPayload {
  sub: number;
  tv: number;
  kind: 'admin';
  csrf: string;
}

export interface UserTokenPayload {
  sub: number;
  kind: 'user';
  tv: number;
  csrf: string;
}

export interface UserAuthInfo {
  id: number;
  kind: 'user';
  name: string;
  studentNumber: string;
  phone: string;
  csrfToken: string;
}

function validBasePayload(payload: { sub?: number; tv?: number; csrf?: string }): boolean {
  return (
    Number.isSafeInteger(payload.sub) &&
    Number.isSafeInteger(payload.tv) &&
    typeof payload.csrf === 'string' &&
    payload.csrf.length >= 32
  );
}

export function buildAuthenticate(app: FastifyInstance, db: Db) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = readSessionCookie(request, 'admin');
    if (!token) throw unauthorized();

    let payload: AuthTokenPayload;
    try {
      payload = app.jwt.verify<AuthTokenPayload>(token);
    } catch {
      clearSessionCookie(reply, 'admin');
      throw unauthorized();
    }
    if (payload.kind !== 'admin' || !validBasePayload(payload)) {
      clearSessionCookie(reply, 'admin');
      throw unauthorized();
    }

    const row = db
      .prepare(
        'SELECT id, username, display_name, role, is_active, token_version FROM users WHERE id = ?',
      )
      .get(payload.sub) as
      | {
          id: number;
          username: string;
          display_name: string;
          role: UserRole;
          is_active: number;
          token_version: number;
        }
      | undefined;

    if (!row || !row.is_active) {
      clearSessionCookie(reply, 'admin');
      throw unauthorized('账号不存在或已被停用');
    }
    if (row.token_version !== payload.tv) {
      clearSessionCookie(reply, 'admin');
      throw unauthorized('登录状态已失效，请重新登录');
    }

    verifyCsrf(request, payload.csrf);
    request.user = {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      csrfToken: payload.csrf,
    };
  };
}

export function requireRole(...roles: UserRole[]) {
  return async function checkRole(request: FastifyRequest): Promise<void> {
    if (!request.user) throw unauthorized();
    if (!roles.includes(request.user.role)) {
      throw forbidden('当前账号没有权限执行该操作');
    }
  };
}

export function buildUserAuthenticate(app: FastifyInstance, db: Db) {
  return async function authenticateUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = readSessionCookie(request, 'candidate');
    if (!token) throw unauthorized();

    let payload: UserTokenPayload;
    try {
      payload = app.jwt.verify<UserTokenPayload>(token);
    } catch {
      clearSessionCookie(reply, 'candidate');
      throw unauthorized();
    }
    if (payload.kind !== 'user' || !validBasePayload(payload)) {
      clearSessionCookie(reply, 'candidate');
      throw unauthorized();
    }

    const row = db
      .prepare('SELECT id, name, student_number, phone, token_version FROM applications WHERE id = ?')
      .get(payload.sub) as
      | {
          id: number;
          name: string;
          student_number: string;
          phone: string;
          token_version: number;
        }
      | undefined;

    if (!row) {
      clearSessionCookie(reply, 'candidate');
      throw unauthorized('报名记录不存在或已被删除');
    }
    if (row.token_version !== payload.tv) {
      clearSessionCookie(reply, 'candidate');
      throw unauthorized('登录状态已失效，请重新登录');
    }

    verifyCsrf(request, payload.csrf);
    request.user = {
      id: row.id,
      kind: 'user',
      name: row.name,
      studentNumber: row.student_number,
      phone: row.phone,
      csrfToken: payload.csrf,
    } as unknown as AuthUser;
  };
}
