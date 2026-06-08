import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'dz_dashboard_snapshots';

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

beforeEach(() => {
  mockStorage = createMockStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true, configurable: true });
});

describe('storageManager', () => {
  it('يضيف 100 snapshot ويتحقق أن localStorage لا يتجاوز 3MB', async () => {
    const { addSnapshot, getStorageStatus, clearAllSnapshots } = await import('../storageManager');

    const bigData = { arr: new Array(500).fill('x') };
    for (let i = 0; i < 100; i++) {
      addSnapshot({ ...bigData, index: i });
    }

    const status = getStorageStatus();
    expect(status.snapshotCount).toBe(100);
    expect(status.usedBytes).toBeLessThanOrEqual(3 * 1024 * 1024);

    clearAllSnapshots();
  });

  it('يضيف snapshot قديمة (أكثر من 90 يوم) ويتحقق أنها تُحذف', async () => {
    const { addSnapshot, getAllSnapshots, clearAllSnapshots } = await import('../storageManager');

    const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();

    const snap = addSnapshot({ test: 'old' });

    const metaKey = STORAGE_KEY + '_meta';
    const metaRaw = mockStorage.store[metaKey];
    if (metaRaw) {
      const meta = JSON.parse(metaRaw);
      const snapKey = STORAGE_KEY + '_' + snap.id;
      if (mockStorage.store[snapKey]) {
        const snapData = JSON.parse(mockStorage.store[snapKey]);
        snapData.createdAt = oldDate;
        mockStorage.store[snapKey] = JSON.stringify(snapData);
      }
    }

    const all = getAllSnapshots();
    const hasOld = all.some(s => s.id === snap.id);
    expect(hasOld).toBe(false);

    clearAllSnapshots();
  });
});
