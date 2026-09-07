import { useEffect } from 'react';
import type { TrackingOrder } from '@/types';
import { getSettledMetrics, getDateISOString, isValidDate } from '@/lib/dashboardMetrics';
import { addSnapshot, getAllSnapshots } from '@/lib/storageManager';

export function useAutoSnapshot(trackingOrders: TrackingOrder[], enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const saveIfDue = () => {
      const now = new Date();
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Algiers', hour: '2-digit', hourCycle: 'h23' }).format(now));
      if (hour < 22) return;
      const date = getDateISOString(now);
      try {
        if (getAllSnapshots().some(s => (s.data as { date?: string })?.date === date)) return;
        const orders = trackingOrders.filter(t => isValidDate(t.date) && getDateISOString(t.date) === date);
        const metrics = getSettledMetrics(orders);
        addSnapshot({ date, totalOrders: orders.length, delivered: metrics.deliveredCount, returned: metrics.returnedCount, totalRevenue: metrics.deliveredRevenue });
        window.dispatchEvent(new CustomEvent('snapshot-saved'));
      } catch { window.dispatchEvent(new CustomEvent('snapshot-error')); }
    };
    saveIfDue();
    const timer = setInterval(saveIfDue, 60000);
    return () => clearInterval(timer);
  }, [trackingOrders, enabled]);
}
