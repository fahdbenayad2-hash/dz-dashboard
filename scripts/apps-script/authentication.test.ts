import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('./Authentication.gs', import.meta.url), 'utf8');
const jwt = (hours: number) => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + hours * 3600 })).toString('base64url')}.signature`;
function setup(auto = true) {
  const properties = new Map<string, string>([
    ['JWT_TOKEN', jwt(-1)], ['OCTO_AUTO_LOGIN', String(auto)],
    ['OCTO_LOGIN_ACCOUNT', 'test@example.invalid'], ['OCTO_LOGIN_PASSWORD', 'test-only'], ['OCTO_STORE_NAME', 'test'],
  ]);
  const fetch = vi.fn();
  const releaseLock = vi.fn();
  const context = {
    CONFIG: { BASE_URL: 'https://test.leaderscod.com' }, getXAuth: () => 'test-key',
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => properties.get(key), setProperty: (key: string, value: string) => properties.set(key, value) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock }) },
    UrlFetchApp: { fetch },
    Utilities: { sleep: vi.fn(), base64DecodeWebSafe: (text: string) => Buffer.from(text, 'base64url'), newBlob: (bytes: Buffer) => ({ getDataAsString: () => bytes.toString() }) },
  };
  runInNewContext(source, context);
  return { properties, fetch, releaseLock, api: context as typeof context & { apiGet_: (path: string) => unknown; octoToken_: (rejected?: string) => string } };
}
const response = (code: number, body: unknown = {}) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body), getHeaders: () => ({}) });
const login = (token: string, domain = 'test.leaderscod.com') => response(200, { token, data: { tenant: { stores: [{ store_name: 'test', domain }] } } });

describe('Apps Script auth adapter (mocked services only)', () => {
  it('does not log in unless automatic mode is explicitly enabled', () => {
    const test = setup(false);
    expect(() => test.api.octoToken_()).toThrow('AUTH_REQUIRED');
    expect(test.fetch).not.toHaveBeenCalled();
  });
  it('normalizes legacy values that already include the Bearer prefix', () => {
    const test = setup(false);
    const current = jwt(24);
    test.properties.set('JWT_TOKEN', `Bearer ${current}`);
    test.fetch.mockReturnValueOnce(response(200, { data: [] }));
    expect(test.api.apiGet_('/tenants/api/orders')).toEqual({ data: [] });
    expect(test.fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${current}`);
  });
  it('verifies a renewed token before replacing the stored token', () => {
    const test = setup();
    const next = jwt(720);
    test.fetch.mockReturnValueOnce(login(next)).mockReturnValueOnce(response(200));
    expect(test.api.octoToken_()).toBe(next);
    expect(test.properties.get('JWT_TOKEN')).toBe(next);
    expect(test.fetch.mock.calls[1][0]).toBe('https://test.leaderscod.com/tenants/api/me');
    expect(test.releaseLock).toHaveBeenCalledOnce();
  });
  it('never sends a renewed credential to a domain returned unexpectedly', () => {
    const test = setup();
    const previous = test.properties.get('JWT_TOKEN');
    test.fetch.mockReturnValueOnce(login(jwt(720), 'other.example'));
    expect(() => test.api.octoToken_()).toThrow('AUTH_RENEWAL_FAILED');
    expect(test.fetch).toHaveBeenCalledOnce();
    expect(test.properties.get('JWT_TOKEN')).toBe(previous);
  });
  it('preserves the previous token and suppresses rapid repeated login failures', () => {
    const test = setup();
    const previous = test.properties.get('JWT_TOKEN');
    test.fetch.mockReturnValue(response(401, { secret: 'never surface this body' }));
    expect(() => test.api.octoToken_()).toThrow('AUTH_RENEWAL_FAILED');
    expect(() => test.api.octoToken_()).toThrow('AUTH_RENEWAL_FAILED');
    expect(test.fetch).toHaveBeenCalledOnce();
    expect(test.properties.get('JWT_TOKEN')).toBe(previous);
  });
  it('renews only once after a data request rejects a still-unexpired token', () => {
    const test = setup();
    test.properties.set('JWT_TOKEN', jwt(24));
    test.fetch.mockReturnValueOnce(response(401)).mockReturnValueOnce(login(jwt(720)))
      .mockReturnValueOnce(response(200)).mockReturnValueOnce(response(401));
    expect(() => test.api.apiGet_('/tenants/api/orders')).toThrow('API_ACCESS_FAILED: 401');
    expect(test.fetch).toHaveBeenCalledTimes(4);
  });
  it.each([403, 423, 429, 500])('does not interpret HTTP %i as an empty result', code => {
    const test = setup();
    test.properties.set('JWT_TOKEN', jwt(24));
    test.fetch.mockReturnValue(response(code));
    expect(() => test.api.apiGet_('/tenants/api/orders')).toThrow();
    expect(test.fetch.mock.calls.length).toBeLessThanOrEqual(3);
  });
});
