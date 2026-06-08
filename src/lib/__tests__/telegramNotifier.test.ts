import { describe, it, expect, beforeEach, vi } from 'vitest';

function createMockStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    store,
  };
}

let mockStorage: ReturnType<typeof createMockStorage>;
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockStorage = createMockStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true, configurable: true });
  mockFetch = vi.fn();
  Object.defineProperty(globalThis, 'fetch', { value: mockFetch, writable: true, configurable: true });
});

describe('telegramNotifier', () => {
  it('botToken فارغ → رسالة خطأ بالعربي', async () => {
    const { sendNotification } = await import('../telegramNotifier');
    const result = await sendNotification({
      type: 'risk_alert',
      title: 'اختبار',
      message: 'رسالة اختبار',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('رمز البوت غير موجود');
  });

  it('نفس نوع التنبيه مرتين في 6 ساعات → لا يُرسل إلا مرة', async () => {
    const { sendNotification, setBotToken, clearThrottle } = await import('../telegramNotifier');
    clearThrottle();

    setBotToken('1234567890:ABCdefGHIjklMNOpqrsTUVwxyzABcDefGHIjklMN');

    mockStorage.setItem('dz_dashboard_telegram_chat_id', '123456789');

    mockFetch.mockResolvedValueOnce({
      json: async () => ({ ok: true, result: {} }),
    });

    const first = await sendNotification({
      type: 'daily_report',
      title: 'تقرير',
      message: 'التقرير اليومي',
    });
    expect(first.success).toBe(true);

    const second = await sendNotification({
      type: 'daily_report',
      title: 'تقرير',
      message: 'التقرير اليومي',
    });
    expect(second.success).toBe(false);
    expect(second.error).toContain('تم إرسال');

    clearThrottle();
  });
});
