/**
 * DZ Dashboard — Telegram Bot Webhook
 * Vercel Edge Function · /api/telegram-bot
 *
 * ENV VARS (Vercel Dashboard → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN   — رمز البوت من @BotFather
 *   TELEGRAM_ALLOWED_ID  — Chat ID ديالك (IDs متعددين مفصولين بفاصلة, مثل "123,456")
 *   SHEET_ID             — ID ديال Google Sheet (موجود أصلاً في sheetsApi.ts)
 */

export const config = { runtime: 'edge' };

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusCategory = 'delivered' | 'returned' | 'transit' | 'delivery' | 'others';

interface Order {
  id: number;
  date: string;
  customer: string;
  phone: string;
  wilaya: string;
  status: string;
  product: string;
  total: number;
  delivery: number;
  agent: string;
}

interface TrackingOrder {
  orderId: string;
  date: Date | null;
  agent: string;
  customer: string;
  wilaya: string;
  trackingStatus: string;
  statusCategory: StatusCategory;
  product: string;
  total: number;
  delivery: number;
  driver: string;
}

interface TelegramMessage {
  message_id: number;
  from: { id: number; first_name: string; username?: string };
  chat: { id: number; type: string };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ─── Google Sheets fetcher (server-side — no CORS issues) ────────────────────

const SHEET_ID = process.env.SHEET_ID || '1WjloEKAQGJA2Z6vgnhni7aByN4ktmPc0xP7EvAUaMUw';

async function fetchSheet(sheetName: string): Promise<{ c: { v: unknown; f?: string }[] | null }[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&headers=1`;
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);
  if (!match) throw new Error('Failed to parse Google Sheets response');
  const response = JSON.parse(match[1]);
  if (response.status === 'error') throw new Error(response.errors?.[0]?.message || 'Sheet API error');
  return response.table.rows || [];
}

async function fetchOrders(): Promise<Order[]> {
  const rows = await fetchSheet('Orders');
  return rows.reduce((acc: Order[], row) => {
    const cells = row.c;
    if (!cells) return acc;
    const id = Number(cells[0]?.v) || 0;
    if (id <= 0) return acc;
    acc.push({
      id,
      date: String(cells[1]?.f || cells[1]?.v || ''),
      customer: String(cells[2]?.v || ''),
      phone: String(cells[3]?.v || ''),
      wilaya: String(cells[4]?.v || ''),
      status: String(cells[5]?.v || 'Pending'),
      product: String(cells[6]?.v || ''),
      total: Number(cells[7]?.v) || 0,
      delivery: Number(cells[8]?.v) || 0,
      agent: String(cells[9]?.v || ''),
    });
    return acc;
  }, []);
}

async function fetchTracking(): Promise<TrackingOrder[]> {
  const rows = await fetchSheet('Tracking');
  return rows.reduce((acc: TrackingOrder[], row) => {
    const cells = row.c;
    if (!cells) return acc;
    const orderId = String(cells[0]?.v || '');
    if (!orderId) return acc;
    const rawStatus = String(cells[5]?.v || '');
    const rawDate = String(cells[1]?.f || cells[1]?.v || '');
    const parsedDate = rawDate ? new Date(rawDate) : null;
    const date = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;
    acc.push({
      orderId,
      date,
      agent: String(cells[2]?.v || ''),
      customer: String(cells[3]?.v || ''),
      wilaya: String(cells[4]?.v || ''),
      trackingStatus: rawStatus,
      statusCategory: classifyStatus(rawStatus),
      product: String(cells[6]?.v || ''),
      total: Number(cells[7]?.v) || 0,
      delivery: Number(cells[8]?.v) || 0,
      driver: String(cells[9]?.v || ''),
    });
    return acc;
  }, []);
}

// ─── Status classifier (مطابق لـ sheetsApi.ts) ───────────────────────────────

function classifyStatus(status: string): StatusCategory {
  const s = (status || '').toString().trim().toLowerCase();
  const delivered = ['livré', 'livre', 'livrée', 'delivered', 'مسلم', 'تم التسليم'];
  const returned = ['retour', 'retourné', 'retournée', 'colis retourné', 'refus', 'refusé', 'refused', 'رجع', 'مرجع', 'إرجاع', 'annulé', 'ملغى', 'ملغي'];
  const transit = ['en transit', 'transit', 'في الطريق', 'vers', 'expédié', 'en cours', 'sorti', 'en route'];
  const delivery = ['en livraison', 'livraison', 'ramassé', 'en cours de livraison', 'camion', 'centre', 'توزيع', 'out for delivery', 'قيد التوزيع', 'prêt', 'en attente de ramassage'];
  if (delivered.some(w => s.includes(w))) return 'delivered';
  if (returned.some(w => s.includes(w))) return 'returned';
  if (transit.some(w => s.includes(w))) return 'transit';
  if (delivery.some(w => s.includes(w))) return 'delivery';
  return 'others';
}

// ─── Metrics helpers (مطابق لـ dashboardMetrics.ts) ──────────────────────────

function normalizeStatus(status: string): string {
  const s = String(status || '').trim();
  if (s === 'مؤكدة') return 'Confirmed';
  if (s.includes('فاشلة')) return 'Failed';
  if (s.includes('انتظار') || s.includes('قيد الانتظار')) return 'Waiting';
  if (s.includes('معلق') || s.includes('قيد المعالجة')) return 'Pending';
  return 'Unknown';
}

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fmt(n: number): string {
  return n.toLocaleString('fr-DZ') + ' دج';
}

function pct(n: number): string {
  return n.toFixed(1) + '%';
}

// ─── Business logic functions ─────────────────────────────────────────────────

function getSettledMetrics(tracking: TrackingOrder[]) {
  const delivered = tracking.filter(t => t.statusCategory === 'delivered');
  const returned = tracking.filter(t => t.statusCategory === 'returned');
  const settled = delivered.length + returned.length;
  const cancellationRate = settled > 0 ? (returned.length / settled) * 100 : 0;
  const deliveryRate = settled > 0 ? (delivered.length / settled) * 100 : 0;
  const deliveredRevenue = delivered.reduce((s, t) => s + t.total, 0);
  const netRevenue = delivered.reduce((s, t) => s + t.total - t.delivery, 0);
  const avgOrderValue = delivered.length > 0 ? deliveredRevenue / delivered.length : 0;
  return { settled, deliveredCount: delivered.length, returnedCount: returned.length, cancellationRate, deliveryRate, deliveredRevenue, netRevenue, avgOrderValue };
}

// ─── Command handlers — كل أمر يرجع نص ──────────────────────────────────────

async function handleStats(): Promise<string> {
  const [orders, tracking] = await Promise.all([fetchOrders(), fetchTracking()]);
  const metrics = getSettledMetrics(tracking);
  const today = toLocalDateKey(new Date());

  const todayOrders = orders.filter(o => {
    const status = normalizeStatus(o.status);
    if (status !== 'Pending' && status !== 'Waiting') return false;
    const d = new Date(o.date);
    return isValidDate(d) && toLocalDateKey(d) === today;
  });

  const todayDelivered = tracking.filter(t =>
    t.statusCategory === 'delivered' && isValidDate(t.date) && toLocalDateKey(t.date) === today
  ).length;

  return [
    `📊 *تقرير اليوم — ${today}*`,
    ``,
    `🆕 طلبات جديدة اليوم: *${todayOrders.length}*`,
    `✅ تسليمات اليوم: *${todayDelivered}*`,
    ``,
    `📦 *إجمالي Tracking*`,
    `• كل الطلبات: ${tracking.length}`,
    `• مُسلَّمة: ${metrics.deliveredCount}`,
    `• مُرجَعة: ${metrics.returnedCount}`,
    `• معدل التسليم: *${pct(metrics.deliveryRate)}*`,
    `• معدل الإلغاء: *${pct(metrics.cancellationRate)}*`,
    ``,
    `💰 *الإيرادات (المُسوَّاة)*`,
    `• إيراد مُسلَّم: ${fmt(metrics.deliveredRevenue)}`,
    `• صافي بعد التوصيل: ${fmt(metrics.netRevenue)}`,
    `• متوسط الطلب: ${fmt(metrics.avgOrderValue)}`,
  ].join('\n');
}

async function handleRevenue(): Promise<string> {
  const tracking = await fetchTracking();

  // آخر 6 أشهر
  const now = new Date();
  const months: { key: string; label: string; revenue: number; orders: number; delivered: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('ar-DZ', { month: 'short', year: 'numeric' });
    const monthOrders = tracking.filter(t => {
      if (!isValidDate(t.date)) return false;
      return `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}` === key;
    });
    const delivered = monthOrders.filter(t => t.statusCategory === 'delivered');
    months.push({
      key,
      label,
      revenue: delivered.reduce((s, t) => s + t.total, 0),
      orders: monthOrders.length,
      delivered: delivered.length,
    });
  }

  const lines = [`💵 *إيراد آخر 6 أشهر*`, ``];
  for (const m of months) {
    const bar = '█'.repeat(Math.min(Math.round(m.revenue / 50000), 10));
    lines.push(`*${m.label}*`);
    lines.push(`  ${bar || '░'} ${fmt(m.revenue)}`);
    lines.push(`  📦 ${m.orders} طلب · ✅ ${m.delivered} مُسلَّم`);
    lines.push(``);
  }

  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  lines.push(`🏁 الإجمالي: *${fmt(totalRevenue)}*`);

  return lines.join('\n');
}

async function handleAgents(): Promise<string> {
  const tracking = await fetchTracking();

  const map = new Map<string, { total: number; delivered: number; returned: number; revenue: number }>();
  tracking.forEach(t => {
    if (!t.agent) return;
    const e = map.get(t.agent) || { total: 0, delivered: 0, returned: 0, revenue: 0 };
    e.total++;
    if (t.statusCategory === 'delivered') { e.delivered++; e.revenue += t.total; }
    if (t.statusCategory === 'returned') e.returned++;
    map.set(t.agent, e);
  });

  const agents = [...map.entries()]
    .map(([name, d]) => {
      const settled = d.delivered + d.returned;
      const deliveryRate = settled > 0 ? (d.delivered / settled) * 100 : 0;
      return { name, ...d, settled, deliveryRate };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const lines = [`👥 *أداء الوكلاء*`, ``];
  for (const ag of agents) {
    const emoji = ag.deliveryRate >= 70 ? '🟢' : ag.deliveryRate >= 50 ? '🟡' : '🔴';
    lines.push(`${emoji} *${ag.name}*`);
    lines.push(`  📦 ${ag.total} طلب · ✅ ${ag.delivered} · ❌ ${ag.returned}`);
    lines.push(`  معدل التسليم: ${pct(ag.deliveryRate)} · إيراد: ${fmt(ag.revenue)}`);
    lines.push(``);
  }

  return lines.join('\n');
}

async function handleWilaya(): Promise<string> {
  const tracking = await fetchTracking();

  const map = new Map<string, { orders: number; delivered: number; revenue: number }>();
  tracking.forEach(t => {
    if (!t.wilaya) return;
    const e = map.get(t.wilaya) || { orders: 0, delivered: 0, revenue: 0 };
    e.orders++;
    if (t.statusCategory === 'delivered') { e.delivered++; e.revenue += t.total; }
    map.set(t.wilaya, e);
  });

  const wilayas = [...map.entries()]
    .map(([name, d]) => ({ name, ...d, deliveryRate: d.orders > 0 ? (d.delivered / d.orders) * 100 : 0 }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  const lines = [`🗺️ *أفضل 10 ولايات*`, ``];
  for (let i = 0; i < wilayas.length; i++) {
    const w = wilayas[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    lines.push(`${medal} *${w.name}*`);
    lines.push(`  ${w.orders} طلب · ${pct(w.deliveryRate)} تسليم · ${fmt(w.revenue)}`);
  }

  return lines.join('\n');
}

async function handleProducts(): Promise<string> {
  const tracking = await fetchTracking();

  const map = new Map<string, { orders: number; delivered: number; returned: number; revenue: number }>();
  tracking.forEach(t => {
    if (!t.product) return;
    const e = map.get(t.product) || { orders: 0, delivered: 0, returned: 0, revenue: 0 };
    e.orders++;
    if (t.statusCategory === 'delivered') { e.delivered++; e.revenue += t.total; }
    if (t.statusCategory === 'returned') e.returned++;
    map.set(t.product, e);
  });

  const products = [...map.entries()]
    .map(([name, d]) => ({ name, ...d, deliveryRate: d.orders > 0 ? (d.delivered / d.orders) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const lines = [`🛍️ *أفضل المنتجات (حسب الإيراد)*`, ``];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    lines.push(`*${i + 1}. ${p.name}*`);
    lines.push(`  💰 ${fmt(p.revenue)} · 📦 ${p.orders} طلب`);
    lines.push(`  ✅ ${p.delivered} · ❌ ${p.returned} · ${pct(p.deliveryRate)} تسليم`);
    lines.push(``);
  }

  return lines.join('\n');
}

async function handleToday(): Promise<string> {
  const [orders, tracking] = await Promise.all([fetchOrders(), fetchTracking()]);
  const today = toLocalDateKey(new Date());

  const todayOrders = orders.filter(o => {
    const status = normalizeStatus(o.status);
    if (status !== 'Pending' && status !== 'Waiting') return false;
    const d = new Date(o.date);
    return isValidDate(d) && toLocalDateKey(d) === today;
  });

  const todayDelivered = tracking.filter(t =>
    t.statusCategory === 'delivered' && isValidDate(t.date) && toLocalDateKey(t.date) === today
  );

  const deliveredRev = todayDelivered.reduce((s, t) => s + t.total, 0);

  // Products today
  const prodMap = new Map<string, { orders: number; revenue: number }>();
  todayDelivered.forEach(t => {
    if (!t.product) return;
    const e = prodMap.get(t.product) || { orders: 0, revenue: 0 };
    e.orders++;
    e.revenue += t.total;
    prodMap.set(t.product, e);
  });
  const topProducts = [...prodMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 3);

  // Wilaya today
  const wilMap = new Map<string, { delivered: number; revenue: number }>();
  todayDelivered.forEach(t => {
    if (!t.wilaya) return;
    const e = wilMap.get(t.wilaya) || { delivered: 0, revenue: 0 };
    e.delivered++;
    e.revenue += t.total;
    wilMap.set(t.wilaya, e);
  });
  const topWilaya = [...wilMap.entries()].sort((a, b) => b[1].delivered - a[1].delivered).slice(0, 3);

  const lines = [
    `📅 *تقرير اليوم — ${today}*`,
    ``,
    `🆕 طلبات جديدة: *${todayOrders.length}*`,
    `✅ تم التسليم: *${todayDelivered.length}*`,
    `💰 إيراد اليوم: *${fmt(deliveredRev)}*`,
    ``,
  ];

  if (topProducts.length > 0) {
    lines.push(`🏆 *أفضل المنتجات اليوم*`);
    topProducts.forEach(([name, d], i) => {
      lines.push(`  ${i + 1}. ${name} — ${fmt(d.revenue)} (${d.orders} طلب)`);
    });
    lines.push(``);
  }

  if (topWilaya.length > 0) {
    lines.push(`📍 *أفضل الولايات اليوم*`);
    topWilaya.forEach(([name, d], i) => {
      lines.push(`  ${i + 1}. ${name} — ${d.delivered} تسليم · ${fmt(d.revenue)}`);
    });
  }

  return lines.join('\n');
}

async function handleWeek(): Promise<string> {
  const [orders, tracking] = await Promise.all([fetchOrders(), fetchTracking()]);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekKey = `${toLocalDateKey(weekAgo)} → ${toLocalDateKey(new Date())}`;

  const weekOrders = orders.filter(o => {
    const status = normalizeStatus(o.status);
    if (status !== 'Pending' && status !== 'Waiting') return false;
    const d = new Date(o.date);
    return isValidDate(d) && d >= weekAgo;
  });

  const weekDelivered = tracking.filter(t =>
    t.statusCategory === 'delivered' && isValidDate(t.date) && t.date >= weekAgo
  );

  const weekReturned = tracking.filter(t =>
    t.statusCategory === 'returned' && isValidDate(t.date) && t.date >= weekAgo
  );

  const deliveredRev = weekDelivered.reduce((s, t) => s + t.total, 0);
  const settled = weekDelivered.length + weekReturned.length;
  const deliveryRate = settled > 0 ? (weekDelivered.length / settled) * 100 : 0;

  // Products week
  const prodMap = new Map<string, { orders: number; revenue: number }>();
  weekDelivered.forEach(t => {
    if (!t.product) return;
    const e = prodMap.get(t.product) || { orders: 0, revenue: 0 };
    e.orders++;
    e.revenue += t.total;
    prodMap.set(t.product, e);
  });
  const topProducts = [...prodMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 3);

  // Wilaya week
  const wilMap = new Map<string, { delivered: number; revenue: number }>();
  weekDelivered.forEach(t => {
    if (!t.wilaya) return;
    const e = wilMap.get(t.wilaya) || { delivered: 0, revenue: 0 };
    e.delivered++;
    e.revenue += t.total;
    wilMap.set(t.wilaya, e);
  });
  const topWilaya = [...wilMap.entries()].sort((a, b) => b[1].delivered - a[1].delivered).slice(0, 3);

  const lines = [
    `📆 *تقرير الأسبوع — ${weekKey}*`,
    ``,
    `🆕 طلبات جديدة: *${weekOrders.length}*`,
    `✅ تم التسليم: *${weekDelivered.length}*`,
    `❌ مرجع: *${weekReturned.length}*`,
    `📊 معدل التسليم: *${pct(deliveryRate)}*`,
    `💰 إيراد الأسبوع: *${fmt(deliveredRev)}*`,
    ``,
  ];

  if (topProducts.length > 0) {
    lines.push(`🏆 *أفضل المنتجات*`);
    topProducts.forEach(([name, d], i) => {
      lines.push(`  ${i + 1}. ${name} — ${fmt(d.revenue)} (${d.orders} طلب)`);
    });
    lines.push(``);
  }

  if (topWilaya.length > 0) {
    lines.push(`📍 *أفضل الولايات*`);
    topWilaya.forEach(([name, d], i) => {
      lines.push(`  ${i + 1}. ${name} — ${d.delivered} تسليم · ${fmt(d.revenue)}`);
    });
  }

  return lines.join('\n');
}

async function handleBestWilaya(): Promise<string> {
  const tracking = await fetchTracking();
  const today = toLocalDateKey(new Date());
  const todayDelivered = tracking.filter(t =>
    t.statusCategory === 'delivered' && isValidDate(t.date) && toLocalDateKey(t.date) === today
  );

  const wilMap = new Map<string, { delivered: number; revenue: number }>();
  todayDelivered.forEach(t => {
    if (!t.wilaya) return;
    const e = wilMap.get(t.wilaya) || { delivered: 0, revenue: 0 };
    e.delivered++;
    e.revenue += t.total;
    wilMap.set(t.wilaya, e);
  });

  const top = [...wilMap.entries()]
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.delivered - a.delivered || b.revenue - a.revenue);

  if (top.length === 0) {
    return `📍 لا يوجد تسليمات اليوم.`;
  }

  const totalDelivered = top.reduce((s, w) => s + w.delivered, 0);
  const totalRevenue = top.reduce((s, w) => s + w.revenue, 0);

  const lines = [
    `🏆 *أفضل ولاية اليوم — ${today}*`,
    ``,
    `👑 *${top[0].name}* — ${top[0].delivered} تسليم · ${fmt(top[0].revenue)}`,
    ``,
    `*التصنيف الكامل:*`,
  ];

  top.slice(0, 10).forEach((w, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const pctShare = totalDelivered > 0 ? ((w.delivered / totalDelivered) * 100).toFixed(1) : '0';
    lines.push(`${medal} *${w.name}* — ${w.delivered} تسليم (${pctShare}%) · ${fmt(w.revenue)}`);
  });

  lines.push(``);
  lines.push(`📊 الإجمالي: ${totalDelivered} تسليم · ${fmt(totalRevenue)}`);

  return lines.join('\n');
}

async function handleRisk(): Promise<string> {
  const tracking = await fetchTracking();
  const metrics = getSettledMetrics(tracking);

  // تحليل بسيط للمخاطر
  const riskFactors: string[] = [];
  let riskScore = 0;

  if (metrics.cancellationRate > 40) {
    riskFactors.push(`🔴 معدل إلغاء مرتفع جداً: ${pct(metrics.cancellationRate)} (حد: 40%)`);
    riskScore += 40;
  } else if (metrics.cancellationRate > 25) {
    riskFactors.push(`🟡 معدل إلغاء متوسط: ${pct(metrics.cancellationRate)}`);
    riskScore += 20;
  } else {
    riskFactors.push(`🟢 معدل إلغاء ممتاز: ${pct(metrics.cancellationRate)}`);
  }

  if (metrics.avgOrderValue < 2000) {
    riskFactors.push(`🟡 متوسط الطلب منخفض: ${fmt(metrics.avgOrderValue)}`);
    riskScore += 15;
  } else {
    riskFactors.push(`🟢 متوسط الطلب جيد: ${fmt(metrics.avgOrderValue)}`);
  }

  // طلبات الأسبوع الماضي
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const recentOrders = tracking.filter(t => isValidDate(t.date) && t.date >= lastWeek);
  if (recentOrders.length === 0) {
    riskFactors.push(`🔴 لا يوجد طلبات في آخر 7 أيام`);
    riskScore += 30;
  } else if (recentOrders.length < 10) {
    riskFactors.push(`🟡 طلبات ضعيفة في آخر 7 أيام: ${recentOrders.length}`);
    riskScore += 15;
  } else {
    riskFactors.push(`🟢 نشاط جيد في آخر 7 أيام: ${recentOrders.length} طلب`);
  }

  const level = riskScore >= 50 ? '🔴 مرتفع' : riskScore >= 25 ? '🟡 متوسط' : '🟢 منخفض';

  const lines = [
    `⚠️ *تقرير المخاطر*`,
    ``,
    `مستوى الخطر: *${level}* (نقاط: ${riskScore}/100)`,
    ``,
    `*العوامل المحللة:*`,
    ...riskFactors,
    ``,
    `📊 البيانات المُسوَّاة: ${metrics.settled} طلب`,
    `✅ مُسلَّم: ${metrics.deliveredCount} · ❌ مُرجَع: ${metrics.returnedCount}`,
  ];

  return lines.join('\n');
}

function handleHelp(): string {
  return [
    `🤖 *DZ Dashboard Bot*`,
    ``,
    `الأوامر المتاحة:`,
    ``,
    `/stats — تقرير عام + KPIs`,
    `/today — تقرير اليوم (منتجات + ولايات)`,
    `/week — تقرير الأسبوع`,
    `/bestwilaya — أفضل ولاية اليوم`,
    `/revenue — إيراد آخر 6 أشهر`,
    `/agents — أداء الوكلاء`,
    `/wilaya — أفضل 10 ولايات`,
    `/products — أفضل المنتجات`,
    `/risk — تقرير المخاطر`,
    `/help — هذه القائمة`,
    ``,
    `_البيانات مباشرة من Google Sheets_`,
  ].join('\n');
}

// ─── Telegram API helpers ─────────────────────────────────────────────────────

async function sendMessage(chatId: number, text: string, token: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });
}

async function sendTyping(chatId: number, token: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });
}

// ─── Main Edge Function handler ───────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const ALLOWED_ID = process.env.TELEGRAM_ALLOWED_ID;

  if (!BOT_TOKEN) {
    console.error('[BOT] TELEGRAM_BOT_TOKEN not set');
    return new Response('Bot not configured', { status: 500 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const message = update.message;
  if (!message?.text) return new Response('OK', { status: 200 });

  const chatId = message.chat.id;
  const senderId = message.from.id;
  const text = message.text.trim();

  // ── Security: قبول Chat IDs المعتمدة فقط ──
  const allowedIds = ALLOWED_ID ? ALLOWED_ID.split(',').map(id => id.trim()) : [];
  if (allowedIds.length > 0 && !allowedIds.includes(String(senderId))) {
    console.warn(`[BOT] Unauthorized access attempt from: ${senderId}`);
    await sendMessage(chatId, '🚫 غير مصرح لك باستخدام هذا البوت.', BOT_TOKEN);
    return new Response('OK', { status: 200 });
  }

  // ── Route الأوامر ──
  const command = text.split(' ')[0].toLowerCase();

  // أرسل "يكتب..." فوراً
  await sendTyping(chatId, BOT_TOKEN);

  try {
    let response: string;

    switch (command) {
      case '/start':
      case '/help':
        response = handleHelp();
        break;
      case '/stats':
        response = await handleStats();
        break;
      case '/revenue':
        response = await handleRevenue();
        break;
      case '/agents':
        response = await handleAgents();
        break;
      case '/wilaya':
        response = await handleWilaya();
        break;
      case '/products':
        response = await handleProducts();
        break;
      case '/today':
        response = await handleToday();
        break;
      case '/week':
        response = await handleWeek();
        break;
      case '/bestwilaya':
        response = await handleBestWilaya();
        break;
      case '/risk':
        response = await handleRisk();
        break;
      default:
        response = [
          `❓ أمر غير معروف: \`${command}\``,
          ``,
          `اكتب /help لرؤية الأوامر المتاحة.`,
        ].join('\n');
    }

    await sendMessage(chatId, response, BOT_TOKEN);
  } catch (err) {
    console.error('[BOT] Error handling command:', command, err);
    await sendMessage(
      chatId,
      `❌ حدث خطأ أثناء جلب البيانات.\n\`${err instanceof Error ? err.message : 'خطأ غير معروف'}\``,
      BOT_TOKEN
    );
  }

  return new Response('OK', { status: 200 });
}
