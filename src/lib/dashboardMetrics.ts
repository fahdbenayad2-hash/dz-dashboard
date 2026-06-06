import type { Order, TrackingOrder } from '@/types';

export function normalizeStatus(status: string): string {
  const s = String(status || '').trim();
  if (s === 'مؤكدة') return 'Confirmed';
  if (s.includes('فاشلة')) return 'Failed';
  if (s.includes('انتظار') || s.includes('قيد الانتظار')) return 'Waiting';
  if (s.includes('معلق') || s.includes('قيد المعالجة')) return 'Pending';
  return 'Unknown';
}

export function parseOrderDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function getDateISOString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getOrderMetrics(orders: Order[]) {
  const totalOrders = orders.length;
  const confirmedOrders = orders.filter(o => normalizeStatus(o.status) === 'Confirmed').length;
  const failedOrders = orders.filter(o => normalizeStatus(o.status) === 'Failed').length;
  const pendingOrders = orders.filter(o => normalizeStatus(o.status) === 'Pending').length;
  const waitingOrders = orders.filter(o => normalizeStatus(o.status) === 'Waiting').length;
  const cancellationRate = totalOrders > 0 ? (failedOrders / totalOrders) * 100 : 0;
  const grossRevenue = orders.reduce((s, o) => s + o.total, 0);
  const confirmedRevenue = orders.filter(o => normalizeStatus(o.status) === 'Confirmed').reduce((s, o) => s + o.total, 0);
  const averageOrderValue = confirmedOrders > 0 ? confirmedRevenue / confirmedOrders : 0;
  const netAfterDelivery = orders.reduce((s, o) => s + o.total - o.delivery, 0);

  return {
    totalOrders, confirmedOrders, failedOrders, pendingOrders, waitingOrders,
    cancellationRate, grossRevenue, confirmedRevenue, averageOrderValue, netAfterDelivery,
  };
}

export function getStatusDistribution(orders: Order[]) {
  const distribution = [
    { status: 'Confirmed', value: orders.filter(o => normalizeStatus(o.status) === 'Confirmed').length },
    { status: 'Failed', value: orders.filter(o => normalizeStatus(o.status) === 'Failed').length },
    { status: 'Pending', value: orders.filter(o => normalizeStatus(o.status) === 'Pending').length },
    { status: 'Waiting', value: orders.filter(o => normalizeStatus(o.status) === 'Waiting').length },
  ];
  console.log('[DZ-CHANGE] status-distribution', distribution);
  return distribution;
}

export function getDailyConfirmedRevenue(orders: Order[], days: number) {
  const today = new Date();
  const dateLabels = [...Array(days)].map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return getDateISOString(d);
  });

  const confirmedOrders = orders.filter(o => normalizeStatus(o.status) === 'Confirmed');

  const trendData = dateLabels.map(date => {
    const dayOrders = confirmedOrders.filter(o => {
      const d = parseOrderDate(o.date);
      return d && getDateISOString(d) === date;
    });
    return {
      date,
      revenue: dayOrders.reduce((s, o) => s + o.total, 0),
    };
  });

  console.log('[DZ-CHANGE] revenue-trend-14d', trendData);
  return trendData;
}

export function filterLastDays(orders: Order[], days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return orders.filter(o => {
    const d = parseOrderDate(o.date);
    return d && d >= cutoff;
  });
}

export function getAgentOrderCounts(orders: Order[]) {
  const agentMap = new Map<string, number>();
  orders.forEach(o => {
    if (o.agent) agentMap.set(o.agent, (agentMap.get(o.agent) || 0) + 1);
  });
  return [...agentMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

export function getTopWilayas(orders: Order[]) {
  const wilayaMap = new Map<string, number>();
  orders.forEach(o => {
    if (o.wilaya) wilayaMap.set(o.wilaya, (wilayaMap.get(o.wilaya) || 0) + 1);
  });
  return [...wilayaMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

export function getTopProducts(orders: Order[]) {
  const productMap = new Map<string, number>();
  orders.forEach(o => {
    if (o.product) productMap.set(o.product, (productMap.get(o.product) || 0) + o.total);
  });
  return [...productMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
}

// ── Tracking-specific metrics ──

export function getTrackingMetrics(tracking: TrackingOrder[]) {
  const total = tracking.length;
  const delivered = tracking.filter(t => t.statusCategory === 'delivered').length;
  const returned = tracking.filter(t => t.statusCategory === 'returned').length;
  const inTransit = tracking.filter(t => t.statusCategory === 'transit').length;
  const inDelivery = tracking.filter(t => t.statusCategory === 'delivery').length;
  const others = tracking.filter(t => t.statusCategory === 'others').length;
  const totalRevenue = tracking.reduce((s, t) => s + t.total, 0);
  const avgOrderValue = total > 0 ? totalRevenue / total : 0;
  const netRevenue = tracking
    .filter(t => t.statusCategory === 'delivered')
    .reduce((s, t) => s + t.total - t.delivery, 0);
  const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;
  const returnRate = total > 0 ? (returned / total) * 100 : 0;

  return { total, delivered, returned, inTransit, inDelivery, others, totalRevenue, avgOrderValue, netRevenue, deliveryRate, returnRate };
}

export function getTrackingStatusDistribution(tracking: TrackingOrder[]) {
  const delivered = tracking.filter(t => t.statusCategory === 'delivered').length;
  const returned = tracking.filter(t => t.statusCategory === 'returned').length;
  const inTransit = tracking.filter(t => t.statusCategory === 'transit').length;
  const inDelivery = tracking.filter(t => t.statusCategory === 'delivery').length;
  const others = tracking.filter(t => t.statusCategory === 'others').length;
  return { delivered, returned, inTransit, inDelivery, others };
}

export function getAgentCountsTracking(tracking: TrackingOrder[]) {
  const map = new Map<string, number>();
  tracking.forEach(t => {
    if (t.agent) map.set(t.agent, (map.get(t.agent) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
}

export function getAgentDataTracking(tracking: TrackingOrder[]) {
  const map = new Map<string, { total: number; revenue: number; delivered: number }>();
  tracking.forEach(t => {
    if (!t.agent) return;
    const existing = map.get(t.agent) || { total: 0, revenue: 0, delivered: 0 };
    existing.total++;
    existing.revenue += t.total;
    if (t.statusCategory === 'delivered') existing.delivered++;
    map.set(t.agent, existing);
  });
  return [...map.entries()]
    .map(([name, d]) => ({
      name,
      totalOrders: d.total,
      confirmedOrders: d.delivered,
      failedOrders: d.total - d.delivered,
      cancellationRate: d.total > 0 ? ((d.total - d.delivered) / d.total) * 100 : 0,
      totalRevenue: d.revenue,
      avgOrderValue: d.total > 0 ? d.revenue / d.total : 0,
    }))
    .sort((a, b) => b.totalOrders - a.totalOrders);
}

export function getWilayaCountsTracking(tracking: TrackingOrder[]) {
  const map = new Map<string, number>();
  tracking.forEach(t => {
    if (t.wilaya) map.set(t.wilaya, (map.get(t.wilaya) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
}

export function getProductCountsTracking(tracking: TrackingOrder[]) {
  const map = new Map<string, number>();
  tracking.forEach(t => {
    if (t.product) map.set(t.product, (map.get(t.product) || 0) + t.total);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
}

export function getMonthlyRevenueTracking(tracking: TrackingOrder[]) {
  const map = new Map<string, { orders: number; revenue: number }>();
  tracking.forEach(t => {
    if (!t.date) return;
    const key = t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0');
    const existing = map.get(key) || { orders: 0, revenue: 0 };
    existing.orders++;
    existing.revenue += t.total;
    map.set(key, existing);
  });
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.slice(-6);
}

export function getDailyRevenueTracking(tracking: TrackingOrder[], days: number) {
  const today = new Date();
  const dateLabels = [...Array(days)].map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return getDateISOString(d);
  });

  return dateLabels.map(date => {
    const dayOrders = tracking.filter(t => {
      if (!t.date) return false;
      return getDateISOString(t.date) === date;
    });
    return {
      date,
      revenue: dayOrders.reduce((s, t) => s + t.total, 0),
      orders: dayOrders.length,
    };
  });
}

export function filterTrackingLastDays(tracking: TrackingOrder[], days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return tracking.filter(t => t.date && t.date >= cutoff);
}

export function getTodayOrders(orders: Order[]) {
  const today = getDateISOString(new Date());
  const todayOrders = orders.filter(o => {
    const d = parseOrderDate(o.date);
    return d && getDateISOString(d) === today;
  });
  return {
    ordersToday: todayOrders.length,
    revenueToday: todayOrders.reduce((s, o) => s + o.total, 0),
  };
}
