const STORAGE_KEY = 'dz_dashboard_auth';

export function isAuthenticated(): boolean {
  const authed = sessionStorage.getItem(STORAGE_KEY) === 'true';
  if (authed) console.log('[DZ-CHANGE] auth-session-active');
  return authed;
}

export function login(password: string): boolean {
  const PASSWORD = import.meta.env.VITE_DASHBOARD_PASSWORD;
  const success = password === PASSWORD;
  if (success) {
    sessionStorage.setItem(STORAGE_KEY, 'true');
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
