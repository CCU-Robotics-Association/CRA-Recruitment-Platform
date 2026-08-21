import { reactive } from 'vue';

export interface CandidateAuth {
  applicationId: number;
  name: string;
  studentNumber: string;
  phone: string;
  email?: string;
}

const LEGACY_STORAGE_KEYS = ['cra_user_token', 'cra_user_info'];
let restorePromise: Promise<boolean> | null = null;

export const candidateAuth = reactive({
  user: null as CandidateAuth | null,
  csrfToken: '',
  initialized: false,

  get isAuthenticated(): boolean {
    return Boolean(this.user);
  },

  set(user: CandidateAuth, csrfToken: string) {
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
        const response = await fetch('/api/user/auth/me', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) {
          this.clear();
          return false;
        }
        const body = (await response.json()) as {
          csrfToken: string;
          user: CandidateAuth;
        };
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
  }
}
