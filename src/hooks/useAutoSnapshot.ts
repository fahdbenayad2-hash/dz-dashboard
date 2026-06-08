import { useEffect, useRef } from 'react';
import type { TrackingOrder } from '@/types';
import { getSettledMetrics, getDateISOString, isValidDate } from '@/lib/dashboardMetrics';
import { addSnapshot, getAllSnapshots } from '@/lib/storageManager';

function getAlgeriaNow(): Date {
  const now = new Date();
  const algeriaStr = now.toLocaleString('en-US', { timeZone: 'Africa/Algiers' });
  return new Date(algeriaStr);
}

function msUntil22Algeria(): number {
  const now = getAlgeriaNow();
  const target = new Date(now);
  target.setHours(22, 0, 0, 0);

  if (now >= target) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

function isTodaySaved(todayStr: string): boolean {
  try {
    const snapshots = getAllSnapshots();
    return snapshots.some(s => {
      const data = s.data as Record<string, unknown> | null;
      return data && data.date === todayStr;
    });
  } catch {
    return false;
  }
}

export function useAutoSnapshot(trackingOrders: TrackingOrder[]): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (trackingOrders.length === 0) return;

    const scheduleNext = () => {
      const delay = msUntil22Algeria();
      console.log('[DZ-CHANGE] useAutoSnapshot next save in', Math.round(delay / 60000), 'minutes');

      timerRef.current = setTimeout(() => {
        const now = getAlgeriaNow();
        const todayStr = now.toISOString().slice(0, 10);

        if (isTodaySaved(todayStr)) {
          console.log('[DZ-CHANGE] useAutoSnapshot today already saved, skipping');
          scheduleNext();
          return;
        }

        const todayOrders = trackingOrders.filter(t => {
          if (!isValidDate(t.date)) return false;
          return getDateISOString(t.date) === todayStr;
        });

        const settled = getSettledMetrics(todayOrders);
        const snapshot = {
          date: todayStr,
          totalOrders: todayOrders.length,
          delivered: settled.deliveredCount,
          returned: settled.returnedCount,
          totalRevenue: settled.deliveredRevenue,
        };

        addSnapshot(snapshot);
        console.log('[DZ-CHANGE] useAutoSnapshot auto-saved', snapshot);
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [trackingOrders]);
}
