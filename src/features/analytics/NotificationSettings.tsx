import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { sendNotification, setBotToken, getBotToken } from '@/lib/telegramNotifier';
import { CheckCircle, XCircle, Send } from 'lucide-react';

const CONFIG_KEY = 'dz_telegram_config';

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

function loadConfig(): TelegramConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { botToken: '', chatId: '' };
}

function saveConfig(config: TelegramConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  if (config.botToken) {
    setBotToken(config.botToken);
    localStorage.setItem('dz_dashboard_telegram_chat_id', config.chatId);
  }
}

export function NotificationSettings() {
  const [config, setConfig] = useState<TelegramConfig>(loadConfig);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const handleTest = async () => {
    if (!config.botToken || !config.chatId) {
      setTestResult({ success: false, message: '⚠️ يرجى إدخال رمز البوت ومعرف المحادثة أولاً.' });
      return;
    }
    setSending(true);
    setTestResult(null);
    const result = await sendNotification({
      type: 'daily_report',
      title: 'اختبار الاتصال',
      message: '✅ تم توصيل البوت بنجاح! \n\nهذه رسالة اختبار من لوحة تحكم DZ Commerce.',
    });
    setTestResult({
      success: result.success,
      message: result.success ? '✅ تم إرسال رسالة الاختبار بنجاح!' : result.error || '⚠️ فشل الإرسال.',
    });
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">الإشعارات</h1>

      <Card>
        <CardHeader>
          <CardTitle>إعدادات Telegram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">
              رمز البوت (Bot Token)
            </label>
            <Input
              type="password"
              placeholder="1234567890:ABCdefGHIjkl..."
              value={config.botToken}
              onChange={e => setConfig(p => ({ ...p, botToken: e.target.value }))}
              dir="ltr"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              احصل عليه من @BotFather على Telegram
            </p>
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">
              معرف المحادثة (Chat ID)
            </label>
            <Input
              type="text"
              placeholder="123456789"
              value={config.chatId}
              onChange={e => setConfig(p => ({ ...p, chatId: e.target.value }))}
              dir="ltr"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              أرسل /start للبوت ثم افتح https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
            </p>
          </div>

          <div className="pt-2">
            <Button onClick={handleTest} disabled={sending} className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              {sending ? 'جاري الإرسال...' : 'اختبار الاتصال'}
            </Button>
          </div>

          {testResult && (
            <div className={`flex items-start gap-3 p-3 rounded-lg ${
              testResult.success
                ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
            }`}>
              {testResult.success
                ? <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                : <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
              }
              <div>
                <p className="text-sm font-medium">{testResult.message}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>أنواع التنبيهات المتاحة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
              <span>التقرير اليومي</span>
              <span className="text-xs text-[var(--color-text-muted)]">daily_report</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
              <span>تنبيه المخاطر</span>
              <span className="text-xs text-[var(--color-text-muted)]">risk_alert</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
              <span>نقص المخزون</span>
              <span className="text-xs text-[var(--color-text-muted)]">low_stock</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span>شذوذ الطلبات</span>
              <span className="text-xs text-[var(--color-text-muted)]">order_anomaly</span>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-4">
            التنبيهات محددة ب 6 ساعات بين الإرسال والإرسال التالي من نفس النوع.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
