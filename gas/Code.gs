/**
 * DZ Commerce Intelligence — Google Apps Script v2
 * Full Refresh: يمسح ويعيد كل البيانات من الصفر عند كل مزامنة
 * Orders مرتبة من الأحدث للأقدم — Tracking نفس الشيء
 * تجديد تلقائي كل ساعة عبر Time-driven Trigger
 *
 * Sheet names: Orders, Tracking, Dashboard, Filters, FilteredView
 * القائمة: 🚀 لوحة التحكم
 */

// ──────────────────────────────────────────────
//  CONFIG
// ──────────────────────────────────────────────

var CONFIG = {
  BASE_URL: 'https://femmesoir.leaderscod.com',
  TOKEN: '',   // يُحمَّل من Properties تلقائياً
  X_AUTH: '',  // يُحمَّل من Properties تلقائياً

  ORDERS_ENDPOINT:   '/tenants/api/orders',
  TRACKING_ENDPOINT: '/tenants/api/tracking-order',
  ORDERS_LIMIT:   50,
  TRACKING_LIMIT: 70,
  TIMEOUT_MINUTES: 5,
  MAX_RETRIES: 3,

  ORDERS_HEADERS: [
    'Order ID','Date','Customer','Phone',
    'Wilaya','Status','Product','Total','Delivery','Agent'
  ],
  TRACKING_HEADERS: [
    'Order ID','Date','Agent','Customer',
    'Wilaya','Tracking Status','Product','Total','Delivery','Driver'
  ],

  STATUS_MAP: {
    delivered: ['livré','livre','livrée','delivered','مسلم','تم التسليم'],
    returned:  ['retour','retourné','retournée','colis retourné','refus','refusé',
                'refused','رجع','مرجع','إرجاع','annulé','annulée','ملغى'],
    transit:   ['en transit','transit','في الطريق','vers','expédié','en cours',
                'sorti','en route'],
    delivery:  ['en livraison','livraison','ramassé','en cours de livraison',
                'camion','centre','توزيع','out for delivery','قيد التوزيع',
                'prêt','prêt à expedit','en attente de ramassage']
  },
};

// ──────────────────────────────────────────────
//  MENU
// ──────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 لوحة التحكم')
    .addItem('🔄 تحديث كل البيانات',      'updateAll')
    .addItem('📦 مزامنة الطلبات',         'syncOrders')
    .addItem('📦 مزامنة التتبع',          'syncTracking')
    .addItem('📊 بناء لوحة البيانات',     'buildDashboard')
    .addSeparator()
    .addItem('🔧 إعداد الفلاتر',          'setupFiltersSheet')
    .addItem('🔍 تطبيق الفلترة',          'buildFilteredReport')
    .addSeparator()
    .addItem('🔑 تعيين التوكن',           'setToken')
    .addItem('🔑 تعيين مفتاح X-AUTH',     'setXAuth')
    .addToUi();
}

// ──────────────────────────────────────────────
//  AUTH
// ──────────────────────────────────────────────

function setToken() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('🔑 أدخل التوكن الجديد (JWT):');
  if (r.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('JWT_TOKEN', r.getResponseText().trim());
    ui.alert('✅ تم حفظ التوكن');
  }
}

function setXAuth() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('🔑 أدخل مفتاح X-AUTH:');
  if (r.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('X_AUTH_KEY', r.getResponseText().trim());
    ui.alert('✅ تم حفظ مفتاح X-AUTH');
  }
}

function getToken() {
  return PropertiesService.getScriptProperties().getProperty('JWT_TOKEN') || CONFIG.TOKEN || '';
}

function getXAuth() {
  return PropertiesService.getScriptProperties().getProperty('X_AUTH_KEY') || CONFIG.X_AUTH || '';
}

function buildHeaders_() {
  return {
    'Authorization':  'Bearer ' + getToken(),
    'x-authorization': getXAuth(),
    'lang':           'ar',
    'Accept':         'application/json',
    'Content-Type':   'application/json',
  };
}

// ──────────────────────────────────────────────
//  API
// ──────────────────────────────────────────────

function apiGet_(endpoint, params) {
  var url = CONFIG.BASE_URL + endpoint;
  if (params) {
    var qs = Object.keys(params)
      .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
    url += '?' + qs;
  }
  var options = { method: 'GET', headers: buildHeaders_(), muteHttpExceptions: true };

  for (var attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    try {
      var resp = UrlFetchApp.fetch(url, options);
      var code = resp.getResponseCode();
      if (code === 200) return JSON.parse(resp.getContentText());
      if (code === 401) throw new Error('توكن غير صالح — استخدم القائمة لتعيين توكن جديد');
      if (code >= 500) throw new Error('خطأ في الخادم: ' + code);
    } catch (e) {
      if (attempt === CONFIG.MAX_RETRIES - 1) throw e;
      Utilities.sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

// ──────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────

function ensureSheet_(name, headers) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  // امسح المحتوى مع الاحتفاظ بالشيت
  sheet.clearContents();
  sheet.clearFormats();

  if (headers) {
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setBackground('#0f172a')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ──────────────────────────────────────────────
//  1. SYNC ORDERS — Full Refresh
// ──────────────────────────────────────────────

function syncOrders() {
  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var sheet     = ensureSheet_('Orders', CONFIG.ORDERS_HEADERS);
  var startTime = Date.now();
  var timeoutMs = CONFIG.TIMEOUT_MINUTES * 60 * 1000;
  var allRows   = [];
  var page      = 0;

  ss.toast('📦 جاري جلب الطلبات...', 'مزامنة الطلبات', -1);

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      ss.toast('⏰ انتهى الوقت — توقف عند الصفحة ' + page, 'مزامنة الطلبات', 8);
      break;
    }

    var data;
    try {
      data = apiGet_(CONFIG.ORDERS_ENDPOINT, { offset: page, limit: CONFIG.ORDERS_LIMIT });
    } catch (e) {
      ss.toast('❌ ' + e.message, 'خطأ', 10);
      throw e;
    }

    if (!data || !data.data || data.data.length === 0) break;

    for (var i = 0; i < data.data.length; i++) {
      var o = data.data[i];
      allRows.push([
        o.id,
        o.created_at || '',
        (o.customer && o.customer.fullname) || '',
        (o.customer && o.customer.phones && o.customer.phones[0] && o.customer.phones[0].phone) || '',
        (o.addrs && o.addrs.wilaya && o.addrs.wilaya.name) || '',
        (o.status_order && o.status_order.name) || '',
        (o.products_order && o.products_order[0] && o.products_order[0].product && o.products_order[0].product.name) || '',
        Number(o.order_total  || 0),
        Number(o.delivery_cost || 0),
        (o.agent && o.agent.fullname) || '',
      ]);
    }

    if (data.data.length < CONFIG.ORDERS_LIMIT) break;
    page++;
    Utilities.sleep(100);
  }

  // رتّب من الأحدث للأقدم حسب Order ID (عمود 1)
  allRows.sort(function(a, b) { return Number(b[0]) - Number(a[0]); });

  // اكتب دفعة واحدة
  if (allRows.length > 0) {
    sheet.getRange(2, 1, allRows.length, CONFIG.ORDERS_HEADERS.length).setValues(allRows);
    SpreadsheetApp.flush();
  }

  ss.toast('✅ Orders: ' + allRows.length + ' طلب — مرتب من الأحدث', 'مزامنة الطلبات', 5);
  return allRows.length;
}

// ──────────────────────────────────────────────
//  2. SYNC TRACKING — Full Refresh
// ──────────────────────────────────────────────

function syncTracking() {
  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var sheet     = ensureSheet_('Tracking', CONFIG.TRACKING_HEADERS);
  var startTime = Date.now();
  var timeoutMs = CONFIG.TIMEOUT_MINUTES * 60 * 1000;
  var allRows   = [];
  var page      = 0;

  ss.toast('📦 جاري جلب بيانات التتبع...', 'مزامنة التتبع', -1);

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      ss.toast('⏰ انتهى الوقت — توقف عند الصفحة ' + page, 'مزامنة التتبع', 8);
      break;
    }

    var data;
    try {
      data = apiGet_(CONFIG.TRACKING_ENDPOINT, { offset: page, limit: CONFIG.TRACKING_LIMIT });
    } catch (e) {
      ss.toast('❌ ' + e.message, 'خطأ', 10);
      throw e;
    }

    if (!data || !data.data || data.data.length === 0) break;

    for (var i = 0; i < data.data.length; i++) {
      var item = data.data[i];
      allRows.push([
        (item.order && item.order.id) || '',
        item.date_and_time || '',
        (item.confirmed_by && item.confirmed_by.fullname) || '',
        (item.order && item.order.customer && item.order.customer.fullname) || '',
        (item.order && item.order.addrs && item.order.addrs.wilaya && item.order.addrs.wilaya.name) || '',
        item.tracking_status || '',
        (item.order && item.order.products_order && item.order.products_order[0] && item.order.products_order[0].product && item.order.products_order[0].product.name) || '',
        Number((item.order && item.order.order_total)  || 0),
        Number((item.order && item.order.delivery_cost) || 0),
        item.driver_name || '',
      ]);
    }

    // توقف إذا وصلنا للنهاية
    if (data.all_count) {
      if ((page + 1) * CONFIG.TRACKING_LIMIT >= data.all_count) break;
    } else {
      if (data.data.length < CONFIG.TRACKING_LIMIT) break;
    }

    page++;
    Utilities.sleep(200);
  }

  // رتّب من الأحدث للأقدم حسب Order ID (عمود 1)
  allRows.sort(function(a, b) { return Number(b[0]) - Number(a[0]); });

  // اكتب دفعة واحدة
  if (allRows.length > 0) {
    sheet.getRange(2, 1, allRows.length, CONFIG.TRACKING_HEADERS.length).setValues(allRows);
    SpreadsheetApp.flush();
  }

  ss.toast('✅ Tracking: ' + allRows.length + ' سجل — مرتب من الأحدث', 'مزامنة التتبع', 5);
  return allRows.length;
}

// ──────────────────────────────────────────────
//  3. DASHBOARD
// ──────────────────────────────────────────────

function _classifyStatus(status) {
  var s = (status || '').toString().toLowerCase().trim();
  var M = CONFIG.STATUS_MAP;
  if (M.delivered.some(function(k) { return s.indexOf(k) !== -1; })) return 'delivered';
  if (M.returned.some(function(k)  { return s.indexOf(k) !== -1; })) return 'returned';
  if (M.transit.some(function(k)   { return s.indexOf(k) !== -1; })) return 'transit';
  if (M.delivery.some(function(k)  { return s.indexOf(k) !== -1; })) return 'delivery';
  return 'others';
}

function _computeMetrics(ordersSheet, trackingSheet, tz, todayStr) {
  var m = {
    ordersToday: 0, revenueToday: 0,
    totalOrders: 0, totalRevenue: 0,
    totalTracking: 0, trackingRevenue: 0,
    delivered: 0, returned: 0, inTransit: 0, inDelivery: 0, others: 0,
    wilayas: {}, products: {}, agents: {}, months: {}
  };

  // Orders: حساب اليوم فقط
  if (ordersSheet && ordersSheet.getLastRow() > 1) {
    var oData = ordersSheet.getRange(2, 1, ordersSheet.getLastRow() - 1, 10).getValues();
    for (var oi = 0; oi < oData.length; oi++) {
      var row     = oData[oi];
      var dateRaw = row[1];
      var total   = Number(row[7] || 0);
      var dateStr = '';
      if (dateRaw instanceof Date && !isNaN(dateRaw)) {
        dateStr = Utilities.formatDate(dateRaw, tz, 'yyyy-MM-dd');
      } else {
        dateStr = String(dateRaw || '').trim().split('T')[0].split(' ')[0].substring(0, 10);
      }
      if (dateStr === todayStr) { m.ordersToday++; m.revenueToday += total; }
    }
  }

  // Tracking: كل المقاييس
  if (trackingSheet && trackingSheet.getLastRow() > 1) {
    var tData = trackingSheet.getRange(2, 1, trackingSheet.getLastRow() - 1, 10).getValues();
    m.totalTracking = tData.length;

    for (var ti = 0; ti < tData.length; ti++) {
      var tr       = tData[ti];
      var dateRaw  = tr[1];
      var agent    = (tr[2]  || '').toString().trim();
      var wilaya   = (tr[4]  || '').toString().trim();
      var status   = (tr[5]  || '').toString();
      var product  = (tr[6]  || '').toString().trim();
      var total    = Number(tr[7] || 0);
      var delivery = Number(tr[8] || 0);

      m.totalOrders++;
      m.totalRevenue += total;

      var cls = _classifyStatus(status);
      if      (cls === 'delivered') { m.delivered++;  m.trackingRevenue += (total - delivery); }
      else if (cls === 'returned')  { m.returned++;   }
      else if (cls === 'transit')   { m.inTransit++;  }
      else if (cls === 'delivery')  { m.inDelivery++; }
      else                          { m.others++;     }

      if (agent)   m.agents[agent]     = (m.agents[agent]   || 0) + 1;
      if (wilaya)  m.wilayas[wilaya]   = (m.wilayas[wilaya] || 0) + 1;
      if (product) m.products[product] = (m.products[product] || 0) + 1;

      var monthStr = '';
      if (dateRaw instanceof Date && !isNaN(dateRaw)) {
        monthStr = Utilities.formatDate(dateRaw, tz, 'yyyy-MM');
      } else {
        var s = String(dateRaw || '').trim().split('T')[0].split(' ')[0];
        if (s.length >= 7) monthStr = s.substring(0, 7);
      }
      if (monthStr) {
        if (!m.months[monthStr]) m.months[monthStr] = { count: 0, revenue: 0 };
        m.months[monthStr].count++;
        m.months[monthStr].revenue += total;
      }
    }
  }
  return m;
}

function buildDashboard() {
  var ss           = SpreadsheetApp.getActiveSpreadsheet();
  var ordersSheet  = ss.getSheetByName('Orders');
  var trackingSheet = ss.getSheetByName('Tracking');
  var dashSheet    = ss.getSheetByName('Dashboard');

  if (!dashSheet) { ss.toast('❌ شيت Dashboard غير موجود!', 'خطأ', 5); return; }

  var tz       = Session.getScriptTimeZone();
  var today    = new Date();
  var todayStr = Utilities.formatDate(today, tz, 'yyyy-MM-dd');
  var m        = _computeMetrics(ordersSheet, trackingSheet, tz, todayStr);

  dashSheet.clearContents();
  dashSheet.clearFormats();
  dashSheet.getCharts().forEach(function(c) { dashSheet.removeChart(c); });

  // Header
  dashSheet.getRange('A1:O1').merge()
    .setValue('📊 لوحة التحكم التنفيذية — ' + Utilities.formatDate(today, tz, 'dd/MM/yyyy HH:mm'))
    .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center')
    .setBackground('#0f172a').setFontColor('#ffffff');
  dashSheet.setRowHeight(1, 40);

  // Section titles
  [
    ['A2','B2','💰 مؤشرات الأداء الرئيسية',   '#1e3a8a','#dbeafe'],
    ['D2','E2','🗺️ أعلى 15 ولاية طلباً',      '#065f46','#d1fae5'],
    ['G2','H2','🔥 أعلى 10 منتجات',            '#7c2d12','#fee2e2'],
    ['J2','K2','👤 أداء الوكلاء',              '#4c1d95','#ede9fe'],
    ['M2','O2','📅 تقرير الأشهر (آخر 6)',      '#1e40af','#bfdbfe'],
  ].forEach(function(s) {
    dashSheet.getRange(s[0]+':'+s[1]).merge()
      .setValue(s[2]).setFontSize(10).setFontWeight('bold')
      .setHorizontalAlignment('center').setBackground(s[3]).setFontColor(s[4]);
  });
  dashSheet.setRowHeight(2, 28);

  // Column headers
  [
    ['A3','المؤشر'],['B3','القيمة'],
    ['D3','الولاية'],['E3','الطلبيات'],
    ['G3','المنتج'],['H3','الطلبيات'],
    ['J3','الوكيل'],['K3','الطلبات المؤكدة'],
    ['M3','الشهر'],['N3','الطلبيات'],['O3','المداخيل'],
  ].forEach(function(h) {
    dashSheet.getRange(h[0]).setValue(h[1]).setFontWeight('bold')
      .setBackground('#e2e8f0').setHorizontalAlignment('center');
  });
  dashSheet.setRowHeight(3, 24);

  // KPIs
  var avgOrder     = m.totalOrders   > 0 ? (m.totalRevenue / m.totalOrders) : 0;
  var deliveryRate = m.totalTracking > 0 ? (m.delivered    / m.totalTracking) : 0;
  var returnRate   = m.totalTracking > 0 ? (m.returned     / m.totalTracking) : 0;

  var kpis = [
    ['📅 طلبات اليوم',             m.ordersToday,       '#,##0'],
    ['💵 مداخيل اليوم',            m.revenueToday,      '#,##0" DA"'],
    ['📊 إجمالي الطلبات',          m.totalOrders,       '#,##0'],
    ['📈 إجمالي المبيعات',         m.totalRevenue,      '#,##0" DA"'],
    ['💵 متوسط قيمة الطلب',        avgOrder,            '#,##0" DA"'],
    ['📦 إجمالي المشحون',          m.totalTracking,     '#,##0'],
    ['💸 صافي الأرباح (Livré)',    m.trackingRevenue,   '#,##0" DA"'],
    ['✅ مسلمة (Livré)',            m.delivered,         '#,##0'],
    ['❌ مرجعة (Retour/Refus)',    m.returned,          '#,##0'],
    ['⏳ في الطريق (Transit)',      m.inTransit,         '#,##0'],
    ['🚚 قيد التوصيل (Livraison)', m.inDelivery,        '#,##0'],
    ['⚙️ أخرى / معالجة',          m.others,            '#,##0'],
    ['📉 نسبة التسليم',            deliveryRate,        '0.00%'],
    ['📤 نسبة الإرجاع',            returnRate,          '0.00%'],
    ['🔄 طلبات في الانتظار',       m.inTransit + m.inDelivery, '#,##0'],
  ];

  kpis.forEach(function(kpi, ki) {
    var bg = ki % 2 === 0 ? '#f8fafc' : '#ffffff';
    var row = ki + 4;
    dashSheet.getRange(row, 1).setValue(kpi[0]).setFontSize(9).setHorizontalAlignment('right').setBackground(bg);
    dashSheet.getRange(row, 2).setValue(kpi[1]).setFontWeight('bold').setNumberFormat(kpi[2]).setHorizontalAlignment('center').setBackground(bg);
  });
  dashSheet.setColumnWidth(1, 230);
  dashSheet.setColumnWidth(2, 140);

  // Top 15 Wilayas
  Object.keys(m.wilayas).sort(function(a,b){return m.wilayas[b]-m.wilayas[a];}).slice(0,15)
    .forEach(function(w, wi) {
      var bg = wi%2===0?'#f0fdf4':'#ffffff';
      dashSheet.getRange(wi+4,4).setValue(w).setBackground(bg).setHorizontalAlignment('right');
      dashSheet.getRange(wi+4,5).setValue(m.wilayas[w]).setBackground(bg).setHorizontalAlignment('center').setFontWeight('bold').setNumberFormat('#,##0');
    });

  // Top 10 Products
  Object.keys(m.products).sort(function(a,b){return m.products[b]-m.products[a];}).slice(0,10)
    .forEach(function(p, pi) {
      var bg = pi%2===0?'#fff7ed':'#ffffff';
      dashSheet.getRange(pi+4,7).setValue(p).setBackground(bg).setHorizontalAlignment('right');
      dashSheet.getRange(pi+4,8).setValue(m.products[p]).setBackground(bg).setHorizontalAlignment('center').setFontWeight('bold').setNumberFormat('#,##0');
    });

  // Top 12 Agents
  Object.keys(m.agents).sort(function(a,b){return m.agents[b]-m.agents[a];}).slice(0,12)
    .forEach(function(ag, ai) {
      var bg     = ai%2===0?'#f5f3ff':'#ffffff';
      var medal  = ai===0?'🥇 ':ai===1?'🥈 ':ai===2?'🥉 ':'';
      dashSheet.getRange(ai+4,10).setValue(medal+ag).setBackground(bg).setHorizontalAlignment('right');
      dashSheet.getRange(ai+4,11).setValue(m.agents[ag]).setBackground(bg).setHorizontalAlignment('center').setFontWeight('bold').setNumberFormat('#,##0');
    });

  // Last 6 Months
  Object.keys(m.months).sort().slice(-6).forEach(function(mk, mi) {
    var bg  = mi%2===0?'#eff6ff':'#ffffff';
    var md  = m.months[mk];
    dashSheet.getRange(mi+4,13).setValue(mk).setBackground(bg).setHorizontalAlignment('center');
    dashSheet.getRange(mi+4,14).setValue(md.count).setBackground(bg).setHorizontalAlignment('center').setFontWeight('bold').setNumberFormat('#,##0');
    dashSheet.getRange(mi+4,15).setValue(md.revenue).setBackground(bg).setHorizontalAlignment('center').setFontWeight('bold').setNumberFormat('#,##0" DA"');
  });

  // Pie chart
  var pieData = dashSheet.getRange('Z90:AA94');
  pieData.setValues([
    ['المسلمة',     m.delivered],
    ['المرجعة',     m.returned],
    ['في الطريق',  m.inTransit],
    ['قيد التوصيل',m.inDelivery],
    ['أخرى',        m.others],
  ]);
  dashSheet.insertChart(dashSheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(pieData)
    .setPosition(4, 17, 0, 0)
    .setOption('title', 'نسب حالات الشحن')
    .setOption('is3D', true)
    .setOption('width', 420).setOption('height', 280)
    .setOption('slices', {0:{color:'#10b981'},1:{color:'#ef4444'},2:{color:'#f59e0b'},3:{color:'#3b82f6'},4:{color:'#94a3b8'}})
    .build());

  var wilayaKeys = Object.keys(m.wilayas).sort(function(a,b){return m.wilayas[b]-m.wilayas[a];}).slice(0,15);
  if (wilayaKeys.length > 0) {
    dashSheet.insertChart(dashSheet.newChart()
      .setChartType(Charts.ChartType.BAR)
      .addRange(dashSheet.getRange(3, 4, wilayaKeys.length+1, 2))
      .setPosition(19, 17, 0, 0)
      .setOption('title', 'توزيع الطلبيات حسب الولاية')
      .setOption('colors', ['#1e3a8a']).setOption('legend', {position:'none'})
      .setOption('width', 420).setOption('height', 320)
      .build());
  }

  SpreadsheetApp.flush();
  ss.toast('✅ تم بناء لوحة البيانات', 'Dashboard', 5);
}

// ──────────────────────────────────────────────
//  4. FILTERS
// ──────────────────────────────────────────────

function setupFiltersSheet() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var fSheet = ss.getSheetByName('Filters');
  if (!fSheet) fSheet = ss.insertSheet('Filters');
  fSheet.clearContents(); fSheet.clearFormats();

  fSheet.getRange('A1:D1').merge()
    .setValue('🔍 لوحة الفلترة — اختر الفلاتر ثم شغّل التقرير')
    .setFontSize(13).setFontWeight('bold')
    .setBackground('#0f172a').setFontColor('#ffffff').setHorizontalAlignment('center');
  fSheet.setRowHeight(1, 38);

  [
    ['B3','🗺️ الولاية'],
    ['B4','👤 الوكيل'],
    ['B5','📦 المنتج'],
    ['B6','📅 تاريخ البداية (YYYY-MM-DD)'],
    ['B7','📅 تاريخ النهاية (YYYY-MM-DD)'],
  ].forEach(function(l) {
    fSheet.getRange(l[0]).setValue(l[1]).setFontWeight('bold').setHorizontalAlignment('right').setBackground('#e2e8f0');
  });

  fSheet.getRange('C3:C7').setBackground('#fefce8').setHorizontalAlignment('center')
    .setBorder(true,true,true,true,false,false,'#94a3b8',SpreadsheetApp.BorderStyle.SOLID);
  ['الكل','الكل','الكل','',''].forEach(function(v,i) {
    fSheet.getRange('C' + (i+3)).setValue(v);
  });

  refreshFilterDropdowns();
  fSheet.setColumnWidth(2, 230); fSheet.setColumnWidth(3, 200);
  ss.toast('✅ تم إعداد شيت الفلاتر', 'الفلاتر', 3);
}

function refreshFilterDropdowns() {
  var ss           = SpreadsheetApp.getActiveSpreadsheet();
  var fSheet       = ss.getSheetByName('Filters');
  var trackingSheet = ss.getSheetByName('Tracking');
  if (!fSheet) return;

  var wSet={}, aSet={}, pSet={};
  if (trackingSheet && trackingSheet.getLastRow() > 1) {
    var data = trackingSheet.getRange(2,1,trackingSheet.getLastRow()-1,10).getValues();
    data.forEach(function(row) {
      var w=(row[4]||'').toString().trim(), a=(row[2]||'').toString().trim(), p=(row[6]||'').toString().trim();
      if(w) wSet[w]=true; if(a) aSet[a]=true; if(p) pSet[p]=true;
    });
  }
  var mkRule = function(list) {
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(['الكل'].concat(list.sort()), true)
      .setAllowInvalid(true).build();
  };
  fSheet.getRange('C3').setDataValidation(mkRule(Object.keys(wSet)));
  fSheet.getRange('C4').setDataValidation(mkRule(Object.keys(aSet)));
  fSheet.getRange('C5').setDataValidation(mkRule(Object.keys(pSet)));
}

function buildFilteredReport() {
  var ss           = SpreadsheetApp.getActiveSpreadsheet();
  var fSheet       = ss.getSheetByName('Filters');
  var trackingSheet = ss.getSheetByName('Tracking');
  if (!fSheet)        { SpreadsheetApp.getUi().alert('❌ شيت Filters غير موجود!'); return; }
  if (!trackingSheet || trackingSheet.getLastRow() < 2) { SpreadsheetApp.getUi().alert('❌ شيت Tracking فارغ!'); return; }

  var fWilaya  = fSheet.getRange('C3').getValue().toString().trim();
  var fAgent   = fSheet.getRange('C4').getValue().toString().trim();
  var fProduct = fSheet.getRange('C5').getValue().toString().trim();
  var fStart   = fSheet.getRange('C6').getValue().toString().trim();
  var fEnd     = fSheet.getRange('C7').getValue().toString().trim();

  var tz   = Session.getScriptTimeZone();
  var data = trackingSheet.getRange(2,1,trackingSheet.getLastRow()-1,10).getValues();

  var filtered = data.filter(function(row) {
    var dateStr = '';
    if (row[1] instanceof Date && !isNaN(row[1])) {
      dateStr = Utilities.formatDate(row[1], tz, 'yyyy-MM-dd');
    } else {
      dateStr = String(row[1]||'').split('T')[0].split(' ')[0].substring(0,10);
    }
    if (fWilaya  !== 'الكل' && fWilaya  && (row[4]||'').toString().trim() !== fWilaya)  return false;
    if (fAgent   !== 'الكل' && fAgent   && (row[2]||'').toString().trim() !== fAgent)   return false;
    if (fProduct !== 'الكل' && fProduct && (row[6]||'').toString().trim() !== fProduct) return false;
    if (fStart.length===10  && dateStr < fStart) return false;
    if (fEnd.length===10    && dateStr > fEnd)   return false;
    return true;
  });

  var viewSheet = ss.getSheetByName('FilteredView');
  if (!viewSheet) viewSheet = ss.insertSheet('FilteredView');
  viewSheet.clearContents(); viewSheet.clearFormats();

  var parts=[];
  if(fWilaya!=='الكل'&&fWilaya)   parts.push('ولاية: '+fWilaya);
  if(fAgent!=='الكل'&&fAgent)     parts.push('وكيل: '+fAgent);
  if(fProduct!=='الكل'&&fProduct) parts.push('منتج: '+fProduct);
  if(fStart.length===10)          parts.push('من: '+fStart);
  if(fEnd.length===10)            parts.push('إلى: '+fEnd);

  viewSheet.getRange('A1:J1').merge()
    .setValue('📋 تقرير مُفلتر — ' + (parts.length?parts.join(' | '):'جميع السجلات'))
    .setFontSize(12).setFontWeight('bold')
    .setBackground('#1e3a8a').setFontColor('#ffffff').setHorizontalAlignment('center');
  viewSheet.setRowHeight(1,36);

  viewSheet.getRange(2,1,1,10).setValues([['Order ID','التاريخ','الوكيل','العميل','الولاية','الحالة','المنتج','الإجمالي','الشحن','السائق']])
    .setFontWeight('bold').setBackground('#dbeafe').setHorizontalAlignment('center');

  if (filtered.length > 0) {
    viewSheet.getRange(3,1,filtered.length,10).setValues(filtered);
    viewSheet.getRange(3,8,filtered.length,1).setNumberFormat('#,##0" DA"');
    viewSheet.getRange(3,9,filtered.length,1).setNumberFormat('#,##0" DA"');
    filtered.forEach(function(_,fi){ viewSheet.getRange(fi+3,1,1,10).setBackground(fi%2===0?'#f8fafc':'#ffffff'); });
  } else {
    viewSheet.getRange('A3:J3').merge().setValue('⚠️ لا توجد نتائج.').setHorizontalAlignment('center').setFontColor('#dc2626');
  }

  // ملخص
  var tDel=0,tRet=0,tOther=0;
  var revTotal = filtered.reduce(function(s,r){ return s+Number(r[7]||0); },0);
  filtered.forEach(function(r){
    var cls=_classifyStatus(r[5]);
    if(cls==='delivered') tDel++; else if(cls==='returned') tRet++; else tOther++;
  });
  var sRow = filtered.length + 5;
  viewSheet.getRange(sRow,1,7,2).setValues([
    ['📊 ملخص',''],
    ['عدد السجلات', filtered.length],
    ['إجمالي المداخيل', revTotal],
    ['متوسط قيمة الطلب', filtered.length>0?revTotal/filtered.length:0],
    ['✅ مسلمة', tDel],
    ['❌ مرجعة', tRet],
    ['🔄 قيد المعالجة', tOther],
  ]);
  viewSheet.getRange(sRow,1,1,2).merge().setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff').setHorizontalAlignment('center');

  SpreadsheetApp.flush();
  ss.setActiveSheet(viewSheet);
  SpreadsheetApp.getUi().alert('✅ التقرير جاهز\n\n📊 ' + filtered.length + ' سجل');
}

// ──────────────────────────────────────────────
//  5. UPDATE ALL (يُستدعى من الـ Trigger أيضاً)
// ──────────────────────────────────────────────

function updateAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('🔄 بدء التحديث الكامل...', 'تحديث', 3);

  try { syncOrders();          } catch(e) { ss.toast('❌ Orders: '   +e.message,'خطأ',10); }
  try { syncTracking();        } catch(e) { ss.toast('❌ Tracking: ' +e.message,'خطأ',10); }
  
  try { refreshFilterDropdowns(); } catch(e) { /* non-critical */ }

  ss.toast('✅ تم التحديث الكامل', 'تحديث', 5);
}
