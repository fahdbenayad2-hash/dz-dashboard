import { afterEach, expect, it, vi } from 'vitest';
import { clearLegacyTelegramSecrets, testTelegramConnection } from '../telegramNotifier';
afterEach(() => vi.unstubAllGlobals());
it('removes legacy secrets without reading or sending them', () => {
  const removeItem = vi.fn();
  vi.stubGlobal('localStorage', { removeItem });
  clearLegacyTelegramSecrets();
  expect(removeItem).toHaveBeenCalledWith('dz_dashboard_telegram_bot_token');
  expect(removeItem).toHaveBeenCalledWith('dz_telegram_config');
});
it('uses only the same-origin authenticated test endpoint', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal('fetch', fetcher);
  expect(await testTelegramConnection()).toBe(true);
  expect(fetcher.mock.calls[0][0]).toBe('/api/notification-test');
  expect(fetcher.mock.calls[0][1]).not.toHaveProperty('body');
});
it('reports rejected requests as failures', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  expect(await testTelegramConnection()).toBe(false);
});
