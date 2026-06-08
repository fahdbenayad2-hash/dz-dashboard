import { useState, useMemo, useCallback } from 'react';
import type { TrackingOrder, DailySnapshot, StoredSnapshot } from '@/types';
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

export function useDailyHistory(trackingOrders: TrackingOrder[]): DailyHistoryResult {
  const [version, setVersion] = useState(0);

  const today = getDateISOString(new Date());
  const todayStr = today;

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

  const storedSnapshots = useMemo(() => {
    const raw = getAllSnapshots();
    return raw.map((s: StoredSnapshot) => s.data as DailySnapshot).filter(Boolean);
  }, [version]);

  const snapshots = useMemo(() => {
    return storedSnapshots as DailySnapshot[];
  }, [storedSnapshots]);

  const last30 = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sorted.slice(-30);
  }, [snapshots]);

  const ma7 = useMemo(() => {
    const recent = last30.slice(-7);
    if (recent.length === 0) return { deliveryRate: 0, returnRate: 0 };
    return {
      deliveryRate: recent.reduce((s, d) => s + (d.delivered / Math.max(d.totalOrders, 1)) * 100, 0) / recent.length,
      returnRate: recent.reduce((s, d) => s + (d.returned / Math.max(d.delivered + d.returned, 1)) * 100, 0) / recent.length,
    };
  }, [last30]);

  const ma30 = useMemo(() => {
    if (last30.length === 0) return { deliveryRate: 0, returnRate: 0 };
    return {
      deliveryRate: last30.reduce((s, d) => s + (d.delivered / Math.max(d.totalOrders, 1)) * 100, 0) / last30.length,
      returnRate: last30.reduce((s, d) => s + (d.returned / Math.max(d.delivered + d.returned, 1)) * 100, 0) / last30.length,
    };
  }, [last30]);

  const todaySaved = useMemo(() => {
    return snapshots.some(s => s.date === todayStr);
  }, [snapshots, todayStr]);

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
    setVersion(v => v + 1);
    console.log('[DZ-CHANGE] useDailyHistory saveToday', snapshot);
  }, [todayOrders, todayStr]);

  return { snapshots, todayMetrics, delta, ma7, ma30, todaySaved, saveToday };
}
