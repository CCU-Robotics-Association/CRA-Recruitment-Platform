/**
 * 登录态：token 持久化到 localStorage，用户信息内存缓存。
 */
import { reactive } from 'vue';

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'reviewer';
}

const TOKEN_KEY = 'cra_admin_token';
const USER_KEY = 'cra_admin_user';

function readUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export const authStore = reactive({
  token: localStorage.getItem(TOKEN_KEY) ?? '',
  user: readUser(),
  get isAuthenticated(): boolean {
    return Boolean(this.token);
  },
  get isSuperAdmin(): boolean {
    return this.user?.role === 'super_admin';
  },
  get canManage(): boolean {
    return this.user?.role === 'super_admin' || this.user?.role === 'admin';
  },
  set(token: string, user: AdminUser) {
    this.token = token;
    this.user = user;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    this.token = '';
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
});
