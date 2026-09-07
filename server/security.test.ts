import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticated, COOKIE, issueSession, sessionCookie } from './security';
import session from '../api/session';
import data from '../api/data';
import webhook from '../api/telegram-bot';
import notification from '../api/notification-test';
const origin = 'https://dashboard.example';
beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', 'synthetic-session-secret-at-least-32-characters');
  vi.stubEnv('DASHBOARD_PASSWORD', 'synthetic-password-for-test-only');
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'synthetic-webhook-secret');
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'synthetic-token');
  vi.stubEnv('TELEGRAM_ALLOWED_ID', '123');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const request = (token: string) => new Request(origin, { headers: { cookie: `${COOKIE}=${token}` } });
describe('server sessions', () => {
  it('accepts signed sessions and rejects tampering and expiry', async () => {
    const token = await issueSession();
    expect(await authenticated(request(token))).toBe(true);
    expect(await authenticated(request(token + 'x'))).toBe(false);
    expect(await authenticated(request(await issueSession(Date.now() - 9 * 3600000)))).toBe(false);
    expect(await authenticated(request('true'))).toBe(false);
  });
  it('uses restricted HttpOnly cookies', () => {
    expect(sessionCookie('x')).toContain('HttpOnly; Secure; SameSite=Strict');
    expect(sessionCookie('', 0)).toContain('Max-Age=0');
  });
  it('rejects cross-origin login and invalid passwords', async () => {
    expect((await session(new Request(origin, { method: 'POST', headers: { origin: 'https://other.example' } }))).status).toBe(403);
    expect((await session(new Request(origin, { method: 'POST', headers: { origin }, body: JSON.stringify({ password: 'wrong' }) }))).status).toBe(401);
  });
  it('authenticates through server and clears cookie on logout', async () => {
    const response = await session(new Request(origin, { method: 'POST', headers: { origin }, body: JSON.stringify({ password: process.env.DASHBOARD_PASSWORD }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain(COOKIE);
    const cleared = await session(new Request(origin, { method: 'DELETE', headers: { origin } }));
    expect(cleared.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('fails closed for missing configuration', async () => {
    vi.stubEnv('DASHBOARD_PASSWORD', '');
    expect((await session(new Request(origin, { method: 'POST', headers: { origin }, body: '{}' }))).status).toBe(503);
  });
  it('does not fetch any data for unauthenticated callers', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await data(new Request(origin + '/api/data'))).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
describe('Telegram authorization', () => {
  it('rejects forged webhook requests before any outgoing request', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await webhook(new Request(origin, { method: 'POST', body: '{}' }))).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects unauthorized users and group chats even with a valid webhook secret', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    for (const [id, chatId, type] of [[456, 456, 'private'], [123, -1, 'group']]) {
      const response = await webhook(new Request(origin, { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'synthetic-webhook-secret' }, body: JSON.stringify({ message: { text: '/stats', from: { id }, chat: { id: chatId, type } } }) }));
      expect(response.status).toBe(403);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not send notification tests without a session', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await notification(new Request(origin, { method: 'POST', headers: { origin } }))).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
