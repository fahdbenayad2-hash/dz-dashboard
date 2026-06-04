import type { Order } from '@/types';

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
