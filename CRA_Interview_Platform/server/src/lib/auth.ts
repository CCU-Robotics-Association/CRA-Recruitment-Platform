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
    payload: { sub: number; username: string; role: UserRole; tv: number };
    user: AuthUser;
  }
}

export interface AuthTokenPayload {
  sub: number;
  username: string;
  role: UserRole;
  tv: number;
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
