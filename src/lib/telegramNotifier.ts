import type { NotificationPayload, NotificationType } from '@/types';

const THROTTLE_MS = 6 * 60 * 60 * 1000;

const sentTimestamps = new Map<NotificationType, number>();

export function getBotToken(): string | null {
  try {
    const token = localStorage.getItem('dz_dashboard_telegram_bot_token');
    return token || null;
  } catch { return null; }
}

export function setBotToken(token: string): void {
  localStorage.setItem('dz_dashboard_telegram_bot_token', token);
}

export function clearBotToken(): void {
  localStorage.removeItem('dz_dashboard_telegram_bot_token');
}

export function validateBotToken(token: string): boolean {
  return /^\d{9,10}:[A-Za-z0-9_-]{35,}$/.test(token.trim());
}

export async function sendNotification(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
  const token = getBotToken();

  if (!token || token.trim() === '') {
    return { success: false, error: '⚠️ رمز البوت غير موجود. يرجى إضافة رمز البوت في الإعدادات أولاً.' };
  }

  if (!validateBotToken(token)) {
    return { success: false, error: '⚠️ رمز البوت غير صالح. يرجى التحقق من الرمز.' };
  }

  const lastSent = sentTimestamps.get(payload.type) || 0;
  const now = Date.now();

  if (now - lastSent < THROTTLE_MS) {
    const remaining = Math.ceil((THROTTLE_MS - (now - lastSent)) / 3600000);
    return { success: false, error: `⚠️ تم إرسال هذا التنبيه مؤخراً. يرجى الانتظار ${remaining} ساعة قبل إعادة الإرسال.` };
  }

  try {
    const chatId = localStorage.getItem('dz_dashboard_telegram_chat_id');
    if (!chatId) {
      return { success: false, error: '⚠️ معرف المحادثة (Chat ID) غير موجود. يرجى تعيينه في الإعدادات.' };
    }

    const text = `*${payload.title}*\n\n${payload.message}`;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text,
        parse_mode: 'Markdown',
      }),
    });

    const result = await response.json();

    if (result.ok) {
      sentTimestamps.set(payload.type, now);
      console.log('[DZ-CHANGE] telegram notification sent:', payload.type);
      return { success: true };
    }

    const errorMsg = result.description || 'خطأ غير معروف من Telegram';
    if (errorMsg.includes('chat not found') || errorMsg.includes('bot was blocked')) {
      return { success: false, error: `⚠️ البوت لا يستطيع الوصول للمحادثة. تأكد من أن Chat ID صحيح وأن البوت بدأ المحادثة.` };
    }

    return { success: false, error: `⚠️ فشل إرسال الإشعار: ${errorMsg}` };
  } catch (err) {
    return { success: false, error: `⚠️ فشل الاتصال بخادم Telegram: ${err instanceof Error ? err.message : 'خطأ غير معروف'}` };
  }
}

export function getThrottleRemainingHours(type: NotificationType): number {
  const lastSent = sentTimestamps.get(type) || 0;
  const elapsed = Date.now() - lastSent;
  if (elapsed >= THROTTLE_MS) return 0;
  return Math.ceil((THROTTLE_MS - elapsed) / 3600000);
}

export function clearThrottle(): void {
  sentTimestamps.clear();
}
