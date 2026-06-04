const STORAGE_KEY = 'dz_dashboard_auth';
const SESSION_DURATION = 24 * 60 * 60 * 1000;

interface AuthSession {
  authenticated: true;
  expiresAt: number;
}

export function isAuthenticated(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const session: AuthSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
    console.log('[DZ-CHANGE] auth-session-active');
    return true;
  } catch {
    return false;
  }
}

export function login(password: string): boolean {
  const PASSWORD = import.meta.env.VITE_DASHBOARD_PASSWORD;
  const success = password === PASSWORD;
  if (success) {
    const session: AuthSession = {
      authenticated: true,
      expiresAt: Date.now() + SESSION_DURATION,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    console.log('[DZ-AUTH] login-success');
    console.log('[DZ-CHANGE] auth-session-active');
  } else {
    console.log('[DZ-AUTH] login-failed');
  }
  return success;
}

export function logout(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  console.log('[DZ-AUTH] logout');
  console.log('[DZ-CHANGE] logout');
}
