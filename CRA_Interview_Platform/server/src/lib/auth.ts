/**
 * 管理端认证：JWT 解析、用户状态校验、角色守卫。
 * token 载荷包含 token_version，管理员重置密码/停用时旧令牌立即失效。
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from './db.ts';
import { forbidden, unauthorized } from './errors.ts';
import type { UserRole } from '../types.ts';

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    // 管理端令牌携带 username/role/tv；用户端令牌携带 kind='user' 与候选人信息。
    // 全部可选以兼容两类令牌的签发。
    payload: {
      sub?: number;
      username?: string;
      role?: UserRole;
      tv?: number;
      kind?: 'admin' | 'user';
      name?: string;
      studentNumber?: string;
    };
    user: AuthUser;
  }
}

export interface AuthTokenPayload {
  sub: number;
  username: string;
  role: UserRole;
  tv: number;
  kind?: 'admin' | 'user';
}

/** 用户端（候选人）令牌载荷：kind='user'，sub=applicationId */
export interface UserTokenPayload {
  sub: number;
  kind: 'user';
  name: string;
  studentNumber: string;
}

/** 用户端认证通过后写入 request.user 的信息 */
export interface UserAuthInfo {
  id: number; // applicationId
  kind: 'user';
  name: string;
  studentNumber: string;
  phone: string;
}

/** 认证 preHandler：校验 token -> 用户存在且启用 -> token_version 匹配 */
export function buildAuthenticate(db: Db) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    let payload: AuthTokenPayload;
    try {
      await request.jwtVerify();
      payload = request.user as unknown as AuthTokenPayload;
    } catch {
      throw unauthorized();
    }

    // 用户端令牌（kind='user'）不得访问管理端接口；旧令牌无 kind 字段时向下兼容
    if (payload.kind && payload.kind !== 'admin') throw unauthorized();

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

    if (!row || !row.is_active) throw unauthorized('账号不存在或已被停用');
    if (row.token_version !== payload.tv) throw unauthorized('登录状态已失效，请重新登录');

    request.user = {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
    };
  };
}

/** 角色守卫：仅允许指定角色访问 */
export function requireRole(...roles: UserRole[]) {
  return async function checkRole(request: FastifyRequest): Promise<void> {
    if (!request.user) throw unauthorized();
    if (!roles.includes(request.user.role)) {
      throw forbidden('当前账号没有权限执行该操作');
    }
  };
}

/**
 * 用户端（候选人）认证 preHandler：
 * 校验 kind='user' 的令牌，sub=applicationId，报名记录存在即视为有效。
 * 报名记录被删除后，对应令牌立即失效。
 */
export function buildUserAuthenticate(db: Db) {
  return async function authenticateUser(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    let payload: UserTokenPayload;
    try {
      await request.jwtVerify();
      payload = request.user as unknown as UserTokenPayload;
    } catch {
      throw unauthorized();
    }

    if (payload.kind !== 'user') throw unauthorized();

    const row = db
      .prepare('SELECT id, name, student_number, phone FROM applications WHERE id = ?')
      .get(payload.sub) as
      | { id: number; name: string; student_number: string; phone: string }
      | undefined;

    if (!row) throw unauthorized('报名记录不存在或已被删除');

    request.user = {
      id: row.id,
      kind: 'user',
      name: row.name,
      studentNumber: row.student_number,
      phone: row.phone,
    } as unknown as AuthUser;
  };
}
