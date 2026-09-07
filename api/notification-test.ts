import { authenticated, json, sameOrigin } from '../server/security';
export const config = { runtime: 'edge' };
export default async function handler(req: Request) {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!sameOrigin(req) || !await authenticated(req)) return json({ error: 'FORBIDDEN' }, 403);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_TEST_CHAT_ID;
  if (!token || !chat || !process.env.TELEGRAM_ALLOWED_ID?.split(',').map(s => s.trim()).includes(chat)) return json({ error: 'NOT_CONFIGURED' }, 503);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ chat_id: chat, text: 'اختبار اتصال DZ Commerce: الإرسال من الخادم يعمل.' }),
    });
    const result = await response.json() as { ok?: boolean };
    return response.ok && result.ok ? json({ success: true }) : json({ error: 'SEND_FAILED' }, 502);
  } catch { return json({ error: 'SEND_FAILED' }, 502); }
}
