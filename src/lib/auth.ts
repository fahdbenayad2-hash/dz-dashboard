const STORAGE_KEY = 'dz_dashboard_auth';

export function isAuthenticated(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function login(password: string): boolean {
  const PASSWORD = import.meta.env.VITE_DASHBOARD_PASSWORD;
  const success = password === PASSWORD;
  if (success) {
    localStorage.setItem(STORAGE_KEY, 'true');
    console.log('[DZ-AUTH] login-success');
  } else {
    console.log('[DZ-AUTH] login-failed');
  }
  return success;
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[DZ-AUTH] logout');
}
