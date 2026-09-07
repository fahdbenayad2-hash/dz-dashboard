import { resetDataCache } from './sheetsApi';
let active = false;
export function isAuthenticated(): boolean { return active; }
export async function checkSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/session', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
    active = response.ok && (await response.json()).authenticated === true;
  } catch { active = false; }
  return active;
}
export async function login(password: string): Promise<boolean> {
  const response = await fetch('/api/session', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }), signal: AbortSignal.timeout(15000) });
  if (response.status === 503) throw new Error('خدمة الدخول تحتاج إعداداً على الخادم.');
  if (!response.ok && response.status !== 401) throw new Error('تعذّر الاتصال بخدمة الدخول.');
  active = response.ok;
  return active;
}
export async function logout(): Promise<void> {
  const response = await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('تعذّر إنهاء الجلسة. أعد المحاولة.');
  active = false;
  resetDataCache();
}
