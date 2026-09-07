import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { clearLegacyTelegramSecrets, testTelegramConnection } from '@/lib/telegramNotifier';

export function NotificationSettings() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  useEffect(() => { clearLegacyTelegramSecrets(); }, []);
  async function test() {
    setBusy(true);
    try { setResult(await testTelegramConnection() ? 'تم إرسال رسالة الاختبار.' : 'تعذّر الإرسال. راجع إعداد الاتصال على الخادم.'); }
    catch { setResult('تعذّر الاتصال. أعد المحاولة.'); }
    finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>اتصال Telegram</CardTitle></CardHeader><CardContent>
    <p className="mb-4">الاتصال يُدار من الخادم. زر الاختبار يرسل رسالة إلى المحادثة المعتمدة.</p>
    <p className="mb-4 text-sm text-[var(--color-text-muted)]">التقارير متاحة بطلبها من البوت. التنبيهات المجدولة غير مفعّلة حالياً.</p>
    <Button disabled={busy} onClick={() => void test()}>{busy ? 'جاري الإرسال...' : 'إرسال رسالة اختبار'}</Button>
    <p role="status" className="mt-4">{result}</p>
  </CardContent></Card>;
}
