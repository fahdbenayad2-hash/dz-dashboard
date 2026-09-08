import { useState, useMemo, useCallback, useEffect } from 'react';
import type { TrackingOrder, DailySnapshot } from '@/types';
import { getSettledMetrics, getDateISOString, isValidDate } from '@/lib/dashboardMetrics';
import { addSnapshot, getAllSnapshots } from '@/lib/storageManager';

interface TodayMetrics {
  deliveryRate: number;
  returnRate: number;
  netRevenue: number;
  totalOrders: number;
}

interface DailyHistoryResult {
  snapshots: DailySnapshot[];
  todayMetrics: TodayMetrics;
  delta: { deliveryRate: number; returnRate: number; netRevenue: number; totalOrders: number };
  ma7: { deliveryRate: number; returnRate: number };
  ma30: { deliveryRate: number; returnRate: number };
  todaySaved: boolean;
  saveToday: () => void;
}

function loadSnapshots(): DailySnapshot[] {
  const raw = getAllSnapshots();
  const days = new Map<string, DailySnapshot>();
  for (const item of raw) { const snapshot = item.data as DailySnapshot; if (snapshot && /^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)) days.set(snapshot.date, snapshot); }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function useDailyHistory(trackingOrders: TrackingOrder[]): DailyHistoryResult {
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>(() => loadSnapshots());

  useEffect(() => {
    const handler = () => setSnapshots(loadSnapshots());
    window.addEventListener('snapshot-saved', handler);
    return () => window.removeEventListener('snapshot-saved', handler);
  }, []);

  const todayStr = getDateISOString(new Date());

  const todayOrders = useMemo(() => {
    return trackingOrders.filter(t => {
      if (!isValidDate(t.date)) return false;
      return getDateISOString(t.date) === todayStr;
    });
  }, [trackingOrders, todayStr]);

  const todayMetrics = useMemo(() => {
    const settled = getSettledMetrics(todayOrders);
    return {
      deliveryRate: settled.deliveryRate,
      returnRate: settled.cancellationRate,
      netRevenue: settled.netRevenue,
      totalOrders: todayOrders.length,
    };
  }, [todayOrders]);

  const yesterdayOrders = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yStr = getDateISOString(d);
    return trackingOrders.filter(t => {
      if (!isValidDate(t.date)) return false;
      return getDateISOString(t.date) === yStr;
    });
  }, [trackingOrders]);

  const yesterdayMetrics = useMemo(() => {
    const settled = getSettledMetrics(yesterdayOrders);
    return {
      deliveryRate: settled.deliveryRate,
      returnRate: settled.cancellationRate,
      netRevenue: settled.netRevenue,
      totalOrders: yesterdayOrders.length,
    };
  }, [yesterdayOrders]);

  const delta = useMemo(() => ({
    deliveryRate: todayMetrics.deliveryRate - yesterdayMetrics.deliveryRate,
    returnRate: todayMetrics.returnRate - yesterdayMetrics.returnRate,
    netRevenue: todayMetrics.netRevenue - yesterdayMetrics.netRevenue,
    totalOrders: todayMetrics.totalOrders - yesterdayMetrics.totalOrders,
  }), [todayMetrics, yesterdayMetrics]);

  const last30 = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const from = new Date(todayStr + 'T12:00:00+01:00'); from.setDate(from.getDate() - 29);
    return sorted.filter(s => s.date >= getDateISOString(from) && s.date <= todayStr);
  }, [snapshots, todayStr]);

  const ma7 = useMemo(() => {
    const from = new Date(todayStr + 'T12:00:00+01:00'); from.setDate(from.getDate() - 6);
    const recent = last30.filter(s => s.date >= getDateISOString(from));
    if (recent.length === 0) return { deliveryRate: 0, returnRate: 0 };
    const delivered = recent.reduce((s, d) => s + d.delivered, 0);
    const returned = recent.reduce((s, d) => s + d.returned, 0);
    const settled = delivered + returned;
    return {
      deliveryRate: settled > 0 ? delivered / settled * 100 : 0,
      returnRate: settled > 0 ? returned / settled * 100 : 0,
    };
  }, [last30, todayStr]);

  const ma30 = useMemo(() => {
    if (last30.length === 0) return { deliveryRate: 0, returnRate: 0 };
    const delivered = last30.reduce((s, d) => s + d.delivered, 0);
    const returned = last30.reduce((s, d) => s + d.returned, 0);
    const settled = delivered + returned;
    return {
      deliveryRate: settled > 0 ? delivered / settled * 100 : 0,
      returnRate: settled > 0 ? returned / settled * 100 : 0,
    };
  }, [last30]);

  const todaySaved = useMemo(() => {
    return snapshots.some(s => s.date === todayStr);
  }, [snapshots, todayStr]);

  const refresh = useCallback(() => {
    setSnapshots(loadSnapshots());
  }, []);

  const saveToday = useCallback(() => {
    const settled = getSettledMetrics(todayOrders);
    const snapshot: DailySnapshot = {
      date: todayStr,
      totalOrders: todayOrders.length,
      delivered: settled.deliveredCount,
      returned: settled.returnedCount,
      totalRevenue: settled.deliveredRevenue,
    };
    addSnapshot(snapshot);
    window.dispatchEvent(new CustomEvent('snapshot-saved'));
    refresh();
    console.log('[DZ-CHANGE] useDailyHistory saveToday', snapshot);
  }, [todayOrders, todayStr, refresh]);

  return { snapshots, todayMetrics, delta, ma7, ma30, todaySaved, saveToday };
}
