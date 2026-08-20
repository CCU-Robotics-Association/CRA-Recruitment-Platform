import { reactive } from 'vue';

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'reviewer';
}

const LEGACY_STORAGE_KEYS = ['cra_admin_token', 'cra_admin_user'];
let restorePromise: Promise<boolean> | null = null;

export const authStore = reactive({
  user: null as AdminUser | null,
  csrfToken: '',
  initialized: false,

  get isAuthenticated(): boolean {
    return Boolean(this.user);
  },
  get isSuperAdmin(): boolean {
    return this.user?.role === 'super_admin';
  },
  get canManage(): boolean {
    return this.user?.role === 'super_admin' || this.user?.role === 'admin';
  },

  set(user: AdminUser, csrfToken: string) {
    this.user = user;
    this.csrfToken = csrfToken;
    this.initialized = true;
    clearLegacyStorage();
  },

  clear() {
    this.user = null;
    this.csrfToken = '';
    this.initialized = true;
    clearLegacyStorage();
  },

  async restore(): Promise<boolean> {
    if (this.initialized) return this.isAuthenticated;
    if (restorePromise) return restorePromise;

    restorePromise = (async () => {
      try {
        const response = await fetch('/api/admin/auth/me', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) {
          this.clear();
          return false;
        }
        const body = (await response.json()) as { csrfToken: string; user: AdminUser };
        this.set(body.user, body.csrfToken);
        return true;
      } catch {
        this.clear();
        return false;
      } finally {
        this.initialized = true;
        restorePromise = null;
      }
    })();

    return restorePromise;
  },
});

function clearLegacyStorage(): void {
  try {
    for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key);
  } catch {
    // 会话只保存在 HttpOnly Cookie 中，本地存储不可用不影响登录。
  }
}
