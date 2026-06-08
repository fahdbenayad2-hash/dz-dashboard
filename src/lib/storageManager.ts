import type { StoredSnapshot, StorageStatus } from '@/types';

const STORAGE_KEY = 'dz_dashboard_snapshots';
const MAX_SIZE_BYTES = 3 * 1024 * 1024;
const SNAPSHOT_TTL_DAYS = 90;

function getSnapshotMeta(): { ids: string[]; sizeMap: Record<string, number> } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + '_meta');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { ids: [], sizeMap: {} };
}

function saveSnapshotMeta(meta: { ids: string[]; sizeMap: Record<string, number> }): void {
  localStorage.setItem(STORAGE_KEY + '_meta', JSON.stringify(meta));
}

function totalUsedBytes(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const val = localStorage.getItem(key);
      if (val) total += key.length * 2 + val.length * 2;
    }
  }
  return total;
}

export function addSnapshot(data: unknown): StoredSnapshot {
  const id = 'snap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const createdAt = new Date().toISOString();
  const dataStr = JSON.stringify(data);
  const sizeBytes = dataStr.length * 2;

  const meta = getSnapshotMeta();
  meta.ids.push(id);
  meta.sizeMap[id] = sizeBytes;

  const snap: StoredSnapshot = { id, createdAt, data, sizeBytes };
  localStorage.setItem(STORAGE_KEY + '_' + id, JSON.stringify(snap));
  saveSnapshotMeta(meta);

  cleanup(meta);

  return snap;
}

export function getSnapshot(id: string): StoredSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + '_' + id);
    if (raw) {
      const parsed: StoredSnapshot = JSON.parse(raw);
      if (isExpired(parsed.createdAt)) {
        deleteSnapshot(id);
        return null;
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

export function getAllSnapshots(): StoredSnapshot[] {
  const meta = getSnapshotMeta();
  const result: StoredSnapshot[] = [];
  const toRemove: string[] = [];
  for (const id of meta.ids) {
    const snap = getSnapshot(id);
    if (snap) result.push(snap);
    else toRemove.push(id);
  }
  if (toRemove.length > 0) {
    meta.ids = meta.ids.filter(id => !toRemove.includes(id));
    for (const id of toRemove) delete meta.sizeMap[id];
    saveSnapshotMeta(meta);
  }
  return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function deleteSnapshot(id: string): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY + '_' + id);
    const meta = getSnapshotMeta();
    meta.ids = meta.ids.filter(i => i !== id);
    delete meta.sizeMap[id];
    saveSnapshotMeta(meta);
    return true;
  } catch { return false; }
}

export function getStorageStatus(): StorageStatus {
  const usedBytes = totalUsedBytes();
  const snapshots = getAllSnapshots();
  return {
    usedBytes,
    usedPercentage: (usedBytes / MAX_SIZE_BYTES) * 100,
    snapshotCount: snapshots.length,
    oldestSnapshot: snapshots.length > 0 ? snapshots[0].createdAt : null,
    newestSnapshot: snapshots.length > 0 ? snapshots[snapshots.length - 1].createdAt : null,
  };
}

export function forceCleanup(): number {
  const meta = getSnapshotMeta();
  let removed = 0;

  const toRemove: string[] = [];
  for (const id of meta.ids) {
    const raw = localStorage.getItem(STORAGE_KEY + '_' + id);
    if (raw) {
      try {
        const snap: StoredSnapshot = JSON.parse(raw);
        if (isExpired(snap.createdAt)) toRemove.push(id);
      } catch { toRemove.push(id); }
    } else {
      toRemove.push(id);
    }
  }

  for (const id of toRemove) {
    localStorage.removeItem(STORAGE_KEY + '_' + id);
    delete meta.sizeMap[id];
    removed++;
  }

  meta.ids = meta.ids.filter(id => !toRemove.includes(id));
  saveSnapshotMeta(meta);

  console.log('[DZ-CHANGE] forceCleanup removed', removed, 'expired snapshots');
  return removed;
}

function isExpired(createdAt: string): boolean {
  const age = Date.now() - new Date(createdAt).getTime();
  return age > SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000;
}

function cleanup(meta: { ids: string[]; sizeMap: Record<string, number> }): void {
  const expired: string[] = [];
  for (const id of meta.ids) {
    const raw = localStorage.getItem(STORAGE_KEY + '_' + id);
    if (raw) {
      try {
        const snap: StoredSnapshot = JSON.parse(raw);
        if (isExpired(snap.createdAt)) expired.push(id);
      } catch { expired.push(id); }
    } else {
      expired.push(id);
    }
  }

  for (const id of expired) {
    localStorage.removeItem(STORAGE_KEY + '_' + id);
    delete meta.sizeMap[id];
  }
  meta.ids = meta.ids.filter(id => !expired.includes(id));

  let totalSize = Object.values(meta.sizeMap).reduce((s, v) => s + v, 0);
  while (totalSize > MAX_SIZE_BYTES && meta.ids.length > 0) {
    const oldest = meta.ids.shift()!;
    totalSize -= meta.sizeMap[oldest] || 0;
    delete meta.sizeMap[oldest];
    localStorage.removeItem(STORAGE_KEY + '_' + oldest);
  }

  saveSnapshotMeta(meta);

  if (expired.length > 0) {
    console.log('[DZ-CHANGE] storageManager cleanup removed', expired.length, 'expired snapshots');
  }
}

export function clearAllSnapshots(): void {
  const meta = getSnapshotMeta();
  for (const id of meta.ids) {
    localStorage.removeItem(STORAGE_KEY + '_' + id);
  }
  localStorage.removeItem(STORAGE_KEY + '_meta');
  console.log('[DZ-CHANGE] clearAllSnapshots removed', meta.ids.length, 'snapshots');
}
