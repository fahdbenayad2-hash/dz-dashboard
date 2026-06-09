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
  return raw.map(s => s.data as DailySnapshot).filter(Boolean);
}

export function useDailyHistory(trackingOrders: TrackingOrder[]): DailyHistoryResult {
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>(() => loadSnapshots());

  useEffect(() => {
    setSnapshots(loadSnapshots());
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
