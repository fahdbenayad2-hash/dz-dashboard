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

export function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

export function getDateISOString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getDateISOStringLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  const settled = getSettledMetrics(tracking);
  const avgOrderValue = settled.avgOrderValue;
  const netRevenue = settled.netRevenue;
  const deliveryRate = settled.deliveryRate;
  const returnRate = settled.cancellationRate;

  return { total, delivered, returned, inTransit, inDelivery, others, totalRevenue, avgOrderValue, netRevenue, deliveryRate, returnRate };
}

export function getSettledMetrics(tracking: TrackingOrder[]) {
  const delivered = tracking.filter(t => t.statusCategory === 'delivered');
  const returned = tracking.filter(t => t.statusCategory === 'returned');
  const settled = delivered.length + returned.length;
  const cancellationRate = settled > 0 ? (returned.length / settled) * 100 : 0;
  const deliveryRate = settled > 0 ? (delivered.length / settled) * 100 : 0;
  const deliveredRevenue = delivered.reduce((s, t) => s + t.total, 0);
  const avgOrderValue = delivered.length > 0 ? deliveredRevenue / delivered.length : 0;
  const netRevenue = delivered.reduce((s, t) => s + t.total - t.delivery, 0);
  const result = { settledCount: settled, deliveredCount: delivered.length, returnedCount: returned.length, cancellationRate, deliveryRate, deliveredRevenue, avgOrderValue, netRevenue };
  console.log('[DZ-CHANGE] settled-metrics', { settledCount: result.settledCount, cancellationRate: result.cancellationRate, deliveryRate: result.deliveryRate });
  return result;
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
  const map = new Map<string, { total: number; revenue: number; delivered: number; returned: number; deliveredRevenue: number }>();
  tracking.forEach(t => {
    if (!t.agent) return;
    const existing = map.get(t.agent) || { total: 0, revenue: 0, delivered: 0, returned: 0, deliveredRevenue: 0 };
    existing.total++;
    existing.revenue += t.total;
    if (t.statusCategory === 'delivered') { existing.delivered++; existing.deliveredRevenue += t.total; }
    if (t.statusCategory === 'returned') existing.returned++;
    map.set(t.agent, existing);
  });
  return [...map.entries()]
    .map(([name, d]) => {
      const settled = d.delivered + d.returned;
      return {
        name,
        totalOrders: d.total,
        confirmedOrders: d.delivered,
        failedOrders: d.returned,
        cancellationRate: settled > 0 ? (d.returned / settled) * 100 : 0,
        totalRevenue: d.revenue,
        avgOrderValue: d.delivered > 0 ? d.deliveredRevenue / d.delivered : 0,
      };
    })
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
  tracking
    .filter(t => t.statusCategory === 'delivered')
    .forEach(t => {
      if (t.product) map.set(t.product, (map.get(t.product) || 0) + t.total);
    });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
}

export function getMonthlyRevenueTracking(tracking: TrackingOrder[]) {
  const map = new Map<string, { orders: number; revenue: number }>();
  tracking.forEach(t => {
    if (!isValidDate(t.date)) return;
    const key = t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0');
    const existing = map.get(key) || { orders: 0, revenue: 0 };
    existing.orders++;
    if (t.statusCategory === 'delivered') existing.revenue += t.total;
    map.set(key, existing);
  });
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.slice(-6);
}

export function getDailyRevenueTracking(tracking: TrackingOrder[], days: number, referenceDate?: Date) {
  const ref = referenceDate || new Date();
  const dateLabels = [...Array(days)].map((_, i) => {
    const d = new Date(ref);
    d.setDate(d.getDate() - (days - 1 - i));
    return getDateISOString(d);
  });

  return dateLabels.map(date => {
    const dayOrders = tracking.filter(t => {
      if (!isValidDate(t.date)) return false;
      return getDateISOString(t.date) === date;
    });
    return {
      date,
      revenue: dayOrders
        .filter(t => t.statusCategory === 'delivered')
        .reduce((s, t) => s + t.total, 0),
      orders: dayOrders.length,
    };
  });
}

export function filterTrackingLastDays(tracking: TrackingOrder[], days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return tracking.filter(t => isValidDate(t.date) && t.date >= cutoff);
}

export const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${ARABIC_MONTHS[parseInt(month) - 1] || ''} ${year}`;
}

export function getMonthlyBreakdown(tracking: TrackingOrder[], yearMonth: string) {
  const filtered = tracking.filter(t => {
    if (!isValidDate(t.date)) return false;
    const key = t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0');
    return key === yearMonth;
  });
  const daysInMonth = new Date(parseInt(yearMonth.split('-')[0]), parseInt(yearMonth.split('-')[1]), 0).getDate();
  const lastDayOfMonth = new Date(parseInt(yearMonth.split('-')[0]), parseInt(yearMonth.split('-')[1]), 0);
  console.log('[DZ-CHANGE] monthly-breakdown', { yearMonth, total: filtered.length, daysInMonth });
  return {
    orders: filtered,
    metrics: getTrackingMetrics(filtered),
    statusDist: getTrackingStatusDistribution(filtered),
    topProducts: getProductCountsTracking(filtered),
    topWilayas: getWilayaCountsTracking(filtered),
    dailyTrend: getDailyRevenueTracking(filtered, daysInMonth, lastDayOfMonth),
  };
}

export function getAvailableMonths(tracking: TrackingOrder[]): string[] {
  const set = new Set<string>();
  tracking.forEach(t => {
    if (!isValidDate(t.date)) return;
    set.add(t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0'));
  });
  return [...set].sort().reverse();
}

export function getLast3MonthsSummary(tracking: TrackingOrder[]) {
  const now = new Date();
  return [0, 1, 2].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const filtered = tracking.filter(t => {
      if (!isValidDate(t.date)) return false;
      const k = t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0');
      return k === key;
    });
    return { month: key, ...getTrackingMetrics(filtered) };
  });
}

// ── FEAT-4: Yearly Report ──

export function getYearlyBreakdown(tracking: TrackingOrder[], year: number) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    const filtered = tracking.filter(t => {
      if (!isValidDate(t.date)) return false;
      return t.date.getFullYear() === year && t.date.getMonth() === i;
    });
    const settled = getSettledMetrics(filtered);
    const all = getTrackingMetrics(filtered);
    return {
      month: key,
      label: ARABIC_MONTHS[i],
      totalOrders: all.total,
      delivered: all.delivered,
      returned: all.returned,
      inProgress: all.inTransit + all.inDelivery,
      deliveryRate: settled.deliveryRate,
      cancellationRate: settled.cancellationRate,
      revenue: settled.deliveredRevenue,
      netRevenue: settled.netRevenue,
      avgOrderValue: settled.avgOrderValue,
    };
  });
  return months;
}

export function getYearComparison(tracking: TrackingOrder[], year: number) {
  const currentYear = getYearlyBreakdown(tracking, year);
  const previousYear = getYearlyBreakdown(tracking, year - 1);

  const sumYear = (months: ReturnType<typeof getYearlyBreakdown>) => ({
    totalOrders: months.reduce((s, m) => s + m.totalOrders, 0),
    delivered: months.reduce((s, m) => s + m.delivered, 0),
    returned: months.reduce((s, m) => s + m.returned, 0),
    revenue: months.reduce((s, m) => s + m.revenue, 0),
    netRevenue: months.reduce((s, m) => s + m.netRevenue, 0),
    avgDeliveryRate: months.filter(m => m.totalOrders > 0).reduce((s, m) => s + m.deliveryRate, 0) /
      (months.filter(m => m.totalOrders > 0).length || 1),
    avgCancellationRate: months.filter(m => m.totalOrders > 0).reduce((s, m) => s + m.cancellationRate, 0) /
      (months.filter(m => m.totalOrders > 0).length || 1),
  });

  const current = sumYear(currentYear);
  const previous = sumYear(previousYear);

  const growth = (curr: number, prev: number) =>
    prev > 0 ? ((curr - prev) / prev) * 100 : 0;

  return {
    year,
    current,
    previous,
    currentMonths: currentYear,
    previousMonths: previousYear,
    growth: {
      orders: growth(current.totalOrders, previous.totalOrders),
      revenue: growth(current.revenue, previous.revenue),
      netRevenue: growth(current.netRevenue, previous.netRevenue),
      deliveryRate: current.avgDeliveryRate - previous.avgDeliveryRate,
    },
  };
}

export function getYearlyTopProducts(tracking: TrackingOrder[], year: number, limit = 15) {
  const map = new Map<string, { revenue: number; orders: number; returned: number }>();
  tracking
    .filter(t => isValidDate(t.date) && t.date.getFullYear() === year && t.product)
    .forEach(t => {
      const e = map.get(t.product) || { revenue: 0, orders: 0, returned: 0 };
      e.orders++;
      if (t.statusCategory === 'delivered') e.revenue += t.total;
      if (t.statusCategory === 'returned') e.returned++;
      map.set(t.product, e);
    });
  return [...map.entries()]
    .map(([name, d]) => ({
      name,
      revenue: d.revenue,
      orders: d.orders,
      returned: d.returned,
      deliveryRate: d.orders > 0 ? ((d.orders - d.returned) / d.orders) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function getYearlyTopWilayas(tracking: TrackingOrder[], year: number, limit = 20) {
  const map = new Map<string, { orders: number; delivered: number; revenue: number }>();
  tracking
    .filter(t => isValidDate(t.date) && t.date.getFullYear() === year && t.wilaya)
    .forEach(t => {
      const e = map.get(t.wilaya) || { orders: 0, delivered: 0, revenue: 0 };
      e.orders++;
      if (t.statusCategory === 'delivered') { e.delivered++; e.revenue += t.total; }
      map.set(t.wilaya, e);
    });
  return [...map.entries()]
    .map(([wilaya, d]) => ({ wilaya, ...d, deliveryRate: d.orders > 0 ? (d.delivered / d.orders) * 100 : 0 }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, limit);
}

// ── FEAT-5: Agent Daily Monitoring ──

export function getAgentDailyStats(tracking: TrackingOrder[], date: string) {
  const dayOrders = tracking.filter(t =>
    isValidDate(t.date) && getDateISOString(t.date) === date
  );
  const agentMap = new Map<string, { orders: number; delivered: number; returned: number; revenue: number }>();
  dayOrders.forEach(t => {
    if (!t.agent) return;
    const e = agentMap.get(t.agent) || { orders: 0, delivered: 0, returned: 0, revenue: 0 };
    e.orders++;
    if (t.statusCategory === 'delivered') { e.delivered++; e.revenue += t.total; }
    if (t.statusCategory === 'returned') e.returned++;
    agentMap.set(t.agent, e);
  });
  return [...agentMap.entries()].map(([name, d]) => ({
    name,
    orders: d.orders,
    delivered: d.delivered,
    returned: d.returned,
    revenue: d.revenue,
    settled: d.delivered + d.returned,
    cancellationRate: (d.delivered + d.returned) > 0
      ? (d.returned / (d.delivered + d.returned)) * 100 : null,
  })).sort((a, b) => b.orders - a.orders);
}

export function getAgentLast7Days(tracking: TrackingOrder[]) {
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return getDateISOString(d);
  });
  return days.map(date => ({
    date,
    label: date.slice(5),
    agents: getAgentDailyStats(tracking, date),
  }));
}

export function getAgentDailyVsMonthlyAvg(tracking: TrackingOrder[], agentName: string) {
  const now = new Date();
  const currentMonthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const todayKey = getDateISOString(now);

  const monthOrders = tracking.filter(t =>
    t.agent === agentName &&
    isValidDate(t.date) &&
    (t.date.getFullYear() + '-' + String(t.date.getMonth() + 1).padStart(2, '0')) === currentMonthKey
  );
  const todayOrders = monthOrders.filter(t => getDateISOString(t.date!) === todayKey);
  const daysElapsed = now.getDate();
  const dailyAvgOrders = daysElapsed > 0 ? monthOrders.length / daysElapsed : 0;
  const todayCount = todayOrders.length;
  const performanceVsAvg = dailyAvgOrders > 0 ? ((todayCount - dailyAvgOrders) / dailyAvgOrders) * 100 : 0;

  return { dailyAvgOrders, todayCount, performanceVsAvg, daysElapsed };
}

export function getTodayOrders(orders: Order[]) {
  const today = getDateISOStringLocal(new Date());
  const todayOrders = orders.filter(o => {
    const status = normalizeStatus(o.status);
    if (status !== 'Pending' && status !== 'Waiting') return false;
    const d = parseOrderDate(o.date);
    return d && getDateISOStringLocal(d) === today;
  });
  return {
    ordersToday: todayOrders.length,
    revenueToday: todayOrders.reduce((s, o) => s + o.total, 0),
  };
}

export function getTodayDelivered(tracking: TrackingOrder[]) {
  const today = getDateISOStringLocal(new Date());
  const count = tracking.filter(t =>
    t.statusCategory === 'delivered' &&
    isValidDate(t.date) &&
    getDateISOStringLocal(t.date) === today
  ).length;
  return count;
}
