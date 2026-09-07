export function clearLegacyTelegramSecrets() {
  for (const key of ['dz_dashboard_telegram_bot_token', 'dz_dashboard_telegram_chat_id', 'dz_telegram_config']) {
    try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
  }
}
export async function testTelegramConnection(): Promise<boolean> {
  const response = await fetch('/api/notification-test', { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(20000) });
  return response.ok && (await response.json()).success === true;
}
