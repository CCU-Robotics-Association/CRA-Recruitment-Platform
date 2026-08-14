/**
 * 用户端登录态：token 持久化到 localStorage，用户信息内存缓存。
 */
import { reactive } from 'vue';

export interface UserAuth {
  applicationId: number;
  name: string;
  studentNumber: string;
  phone: string;
  email: string;
}

const TOKEN_KEY = 'cra_user_token';
const USER_KEY = 'cra_user_info';

function readUser(): UserAuth | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserAuth) : null;
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
  set(token: string, user: UserAuth) {
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
