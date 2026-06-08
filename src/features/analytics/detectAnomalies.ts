import type { TrackingOrder, DailySnapshot } from '@/types';
import { getDateISOString, isValidDate } from '@/lib/dashboardMetrics';

export interface AnomalyResult {
  date: string;
  reason: string;
  zScore: number;
  metric: string;
  actualValue: number;
  expectedValue: number;
}

export function detectAnomalies(tracking: TrackingOrder[], snapshots: DailySnapshot[]): AnomalyResult[] {
  if (snapshots.length < 7) return [];

  const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const anomalies: AnomalyResult[] = [];

  const dailyCounts = new Map<string, number>();
  tracking.forEach(t => {
    if (!isValidDate(t.date)) return;
    const key = getDateISOString(t.date);
    dailyCounts.set(key, (dailyCounts.get(key) || 0) + 1);
  });

  for (const snap of sorted) {
    const actualOrders = dailyCounts.get(snap.date) || 0;
    const actualDelivered = snap.delivered;
    const actualReturned = snap.returned;

    const recent30 = sorted.filter(s => s.date < snap.date).slice(-30);
    if (recent30.length < 7) continue;

    const meanOrders = recent30.reduce((s, d) => s + (dailyCounts.get(d.date) || 0), 0) / recent30.length;
    const stdOrders = Math.sqrt(recent30.reduce((s, d) => s + Math.pow((dailyCounts.get(d.date) || 0) - meanOrders, 2), 0) / recent30.length);

    if (stdOrders > 0) {
      const zOrders = (actualOrders - meanOrders) / stdOrders;
      if (Math.abs(zOrders) > 2.5) {
        anomalies.push({
          date: snap.date,
          reason: actualOrders > meanOrders
            ? `ارتفاع غير طبيعي في الطلبات: ${actualOrders} (المتوقع ${Math.round(meanOrders)})`
            : `انخفاض غير طبيعي في الطلبات: ${actualOrders} (المتوقع ${Math.round(meanOrders)})`,
          zScore: Math.round(zOrders * 100) / 100,
          metric: 'عدد الطلبات',
          actualValue: actualOrders,
          expectedValue: Math.round(meanOrders),
        });
      }
    }

    const meanReturnRate = recent30.reduce((s, d) => {
      const settled = d.delivered + d.returned;
      return s + (settled > 0 ? (d.returned / settled) * 100 : 0);
    }, 0) / recent30.length;

    const settled = actualDelivered + actualReturned;
    const actualReturnRate = settled > 0 ? (actualReturned / settled) * 100 : 0;

    const returnRates = recent30.map(d => {
      const st = d.delivered + d.returned;
      return st > 0 ? (d.returned / st) * 100 : 0;
    });
    const stdReturnRate = Math.sqrt(returnRates.reduce((s, r) => s + Math.pow(r - meanReturnRate, 2), 0) / returnRates.length);

    if (stdReturnRate > 0) {
      const zReturn = (actualReturnRate - meanReturnRate) / stdReturnRate;
      if (zReturn > 2.5) {
        anomalies.push({
          date: snap.date,
          reason: `ارتفاع شاذ في الإرجاع: ${actualReturnRate.toFixed(1)}% (المتوسط ${meanReturnRate.toFixed(1)}%)`,
          zScore: Math.round(zReturn * 100) / 100,
          metric: 'معدل الإرجاع',
          actualValue: Math.round(actualReturnRate * 10) / 10,
          expectedValue: Math.round(meanReturnRate * 10) / 10,
        });
      }
    }
  }

  return anomalies.sort((a, b) => b.zScore - a.zScore).slice(0, 20);
}
