/**
 * DZ Commerce Intelligence — Google Apps Script
 * Fetches orders + tracking from leaderscod.com API into Google Sheets,
 * builds a live Arabic dashboard with KPIs, charts, and filters.
 *
 * Sheet names: Orders, Tracking, Dashboard, Filters, FilteredView
 * All functions accessible via custom menu "🚀 لوحة التحكم"
 */

// ──────────────────────────────────────────────
//  CONFIG
// ──────────────────────────────────────────────

var CONFIG = {
  BASE_URL: 'https://femmesoir.leaderscod.com',
  TOKEN: '',
  X_AUTH: '',
  ORDERS_ENDPOINT: '/tenants/api/orders',
  TRACKING_ENDPOINT: '/tenants/api/tracking-order',
  ORDERS_LIMIT: 50,
  TRACKING_LIMIT: 70,
  WRITE_BATCH: 500,
  TIMEOUT_MINUTES: 5,
  MAX_RETRIES: 3,
  STATUS_MAP: {
    delivered: ["livré", "livre", "livrée", "delivered", "مسلم", "تم التسليم"],
    returned:  ["retour", "retourné", "retournée", "colis retourné", "refus", "refusé",
                "refused", "رجع", "مرجع", "إرجاع", "annulé", "annulée", "ملغى"],
    transit:   ["en transit", "transit", "في الطريق", "vers", "expédié", "en cours",
                "sorti", "en route"],
    delivery:  ["en livraison", "livraison", "ramassé", "en cours de livraison",
                "camion", "centre", "توزيع", "out for delivery", "قيد التوزيع",
                "prêt", "prêt à expedit", "en attente de ramassage"]
  },
};

// ──────────────────────────────────────────────
//  MENU
// ──────────────────────────────────────────────

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 لوحة التحكم')
    .addItem('🔄 تحديث كل البيانات', 'updateAll')
    .addItem('📦 مزامنة الطلبات', 'syncOrdersWithReturn')
    .addItem('📦 مزامنة التتبع', 'syncTrackingWithReturn')
    .addItem('📊 بناء لوحة البيانات', 'buildDashboard')
    .addSeparator()
    .addItem('🔧 إعداد الفلاتر', 'setupFiltersSheet')
    .addItem('🔍 تطبيق الفلترة', 'buildFilteredReport')
    .addSeparator()
    .addItem('🔑 تعيين التوكن', 'setToken')
    .addItem('🔑 تعيين مفتاح X-AUTH', 'setXAuth')
    .addToUi();
}

function setToken() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt('🔑 أدخل التوكن الجديد (JWT):');
  if (response.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('JWT_TOKEN', response.getResponseText().trim());
    CONFIG.TOKEN = response.getResponseText().trim();
    ui.alert('✅ تم حفظ التوكن بنجاح');
  }
}

function setXAuth() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt('🔑 أدخل مفتاح X-AUTH الخاص:');
  if (response.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('X_AUTH_KEY', response.getResponseText().trim());
    CONFIG.X_AUTH = response.getResponseText().trim();
    ui.alert('✅ تم حفظ مفتاح X-AUTH بنجاح');
  }
}

function getToken() {
  if (CONFIG.TOKEN) return CONFIG.TOKEN;
  var stored = PropertiesService.getScriptProperties().getProperty('JWT_TOKEN');
  if (stored) CONFIG.TOKEN = stored;
  return stored || '';
}

function getXAuth() {
  if (CONFIG.X_AUTH) return CONFIG.X_AUTH;
  var stored = PropertiesService.getScriptProperties().getProperty('X_AUTH_KEY');
  if (stored) CONFIG.X_AUTH = stored;
  return stored || '';
}

// ──────────────────────────────────────────────
//  HEADERS
// ──────────────────────────────────────────────

function buildHeaders_() {
  return {
    'Authorization': 'Bearer ' + getToken(),
    'x-authorization': getXAuth(),
    'lang': 'ar',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

// ──────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────

function ensureSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#0f172a')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
    }
  }
  return sheet;
}

function getMaxId_(sheet, colIndex) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var ids = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues().flat().filter(Number);
  return ids.length > 0 ? Math.max.apply(null, ids) : 0;
}

function apiGet_(endpoint, params) {
  var url = CONFIG.BASE_URL + endpoint;
  if (params) {
    var qs = Object.keys(params).map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    url += '?' + qs;
  }
  var options = {
    method: 'GET',
    headers: buildHeaders_(),
    muteHttpExceptions: true,
  };
  for (var retry = 0; retry < CONFIG.MAX_RETRIES; retry++) {
    try {
      var resp = UrlFetchApp.fetch(url, options);
      var code = resp.getResponseCode();
      if (code === 200) {
        var json = JSON.parse(resp.getContentText());
        return json;
      }
      if (code === 401) throw new Error('❌ توكن غير صالح. استخدم القائمة لتعيين توكن جديد.');
      if (code >= 500) throw new Error('❌ خطأ في الخادم: ' + code);
    } catch (e) {
      if (retry === CONFIG.MAX_RETRIES - 1) throw e;
      Utilities.sleep(1000 * (retry + 1));
    }
  }
  return null;
}

function _appendRows(sheet, rows) {
  if (!rows || !rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ──────────────────────────────────────────────
//  1. SYNC ORDERS (Incremental with skip fix)
// ──────────────────────────────────────────────

function syncOrdersWithReturn() {
  var sheet = ensureSheet_('Orders', ['Order ID','Date','Customer','Phone','Wilaya','Status','Product','Total','Delivery','Agent']);
  var props = PropertiesService.getScriptProperties();
  var maxKnownId = Number(props.getProperty('MAX_KNOWN_ORDER_ID') || '0');
  var page = 0;
  var totalWritten = 0;
  var startTime = Date.now();
  var timeoutMs = CONFIG.TIMEOUT_MINUTES * 60 * 1000;
  var currentMax = maxKnownId;
  var buffer = [];

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      props.setProperty('orders_checkpoint', JSON.stringify({ page: page, lastId: currentMax }));
      SpreadsheetApp.getActiveSpreadsheet().toast('⏰ انتهى الوقت. توقف عند الصفحة ' + page + '.', 'مزامنة الطلبات', 10);
      break;
    }

    var data;
    try {
      data = apiGet_(CONFIG.ORDERS_ENDPOINT, { offset: page, limit: CONFIG.ORDERS_LIMIT });
    } catch (e) {
      SpreadsheetApp.getActiveSpreadsheet().toast('❌ ' + e.message, 'خطأ', 10);
      throw e;
    }

    if (!data || !data.data || data.data.length === 0) break;

    var newRows = [];
    var oldCount = 0;
    for (var i = 0; i < data.data.length; i++) {
      var o = data.data[i];
      var oid = Number(o.id);
      if (oid <= maxKnownId) { oldCount++; continue; }
      if (oid > currentMax) currentMax = oid;
      newRows.push([
        o.id,
        o.created_at || '',
        (o.customer && o.customer.fullname) || '',
        (o.customer && o.customer.phones && o.customer.phones[0] && o.customer.phones[0].phone) || '',
        (o.addrs && o.addrs.wilaya && o.addrs.wilaya.name) || '',
        (o.status_order && o.status_order.name) || '',
        (o.products_order && o.products_order[0] && o.products_order[0].product && o.products_order[0].product.name) || '',
        Number(o.order_total || 0),
        Number(o.delivery_cost || 0),
        (o.agent && o.agent.fullname) || '',
      ]);
    }

    if (oldCount === data.data.length) break;

    if (newRows.length > 0) {
      buffer = buffer.concat(newRows);
      if (buffer.length >= CONFIG.WRITE_BATCH) {
        _appendRows(sheet, buffer);
        totalWritten += buffer.length;
        buffer = [];
      }
    }

    if (data.data.length < CONFIG.ORDERS_LIMIT) break;
    page++;
    Utilities.sleep(100);
  }

  if (buffer.length) {
    _appendRows(sheet, buffer);
    totalWritten += buffer.length;
  }

  props.deleteProperty('orders_checkpoint');
  if (currentMax > maxKnownId) props.setProperty('MAX_KNOWN_ORDER_ID', String(currentMax));
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ تمت مزامنة ' + totalWritten + ' طلب جديد', 'مزامنة الطلبات', 5);
  return totalWritten;
}

// ──────────────────────────────────────────────
//  2. SYNC TRACKING (Incremental with skip fix)
// ──────────────────────────────────────────────

function syncTrackingWithReturn() {
  var sheet = ensureSheet_('Tracking', ['Order ID','Date','Agent','Customer','Wilaya','Tracking Status','Product','Total','Delivery','Driver']);
  var props = PropertiesService.getScriptProperties();
  var maxKnownId = Number(props.getProperty('MAX_KNOWN_TRACKING_ID') || '0');
  var page = 0;
  var totalWritten = 0;
  var startTime = Date.now();
  var timeoutMs = CONFIG.TIMEOUT_MINUTES * 60 * 1000;
  var currentMax = maxKnownId;
  var buffer = [];

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      props.setProperty('tracking_checkpoint', JSON.stringify({ page: page, lastId: currentMax }));
      SpreadsheetApp.getActiveSpreadsheet().toast('⏰ انتهى وقت التتبع. استأنف بتشغيل المزامنة مرة أخرى.', 'مزامنة التتبع', 10);
      break;
    }

    var data;
    try {
      data = apiGet_(CONFIG.TRACKING_ENDPOINT, { offset: page, limit: CONFIG.TRACKING_LIMIT });
    } catch (e) {
      SpreadsheetApp.getActiveSpreadsheet().toast('❌ ' + e.message, 'خطأ', 10);
      throw e;
    }

    if (!data || !data.data || data.data.length === 0) break;

    var newRows = [];
    var oldCount = 0;
    for (var i = 0; i < data.data.length; i++) {
      var item = data.data[i];
      var tid = Number(item.id);
      if (tid <= maxKnownId) { oldCount++; continue; }
      if (tid > currentMax) currentMax = tid;

      newRows.push([
        (item.order && item.order.id) || '',
        item.date_and_time || '',
        (item.confirmed_by && item.confirmed_by.fullname) || '',
        (item.order && item.order.customer && item.order.customer.fullname) || '',
        (item.order && item.order.addrs && item.order.addrs.wilaya && item.order.addrs.wilaya.name) || '',
        item.tracking_status || '',
        (item.order && item.order.products_order && item.order.products_order[0] && item.order.products_order[0].product && item.order.products_order[0].product.name) || '',
        Number(item.order && item.order.order_total || 0),
        Number(item.order && item.order.delivery_cost || 0),
        item.driver_name || '',
      ]);
    }

    if (oldCount === data.data.length) break;

    if (newRows.length > 0) {
      buffer = buffer.concat(newRows);
      if (buffer.length >= CONFIG.WRITE_BATCH) {
        _appendRows(sheet, buffer);
        totalWritten += buffer.length;
        buffer = [];
      }
    }

    if (data.all_count) {
      if ((page + 1) * CONFIG.TRACKING_LIMIT >= data.all_count) break;
    } else {
      if (data.data.length < CONFIG.TRACKING_LIMIT) break;
    }

    page++;
    Utilities.sleep(200);
  }

  if (buffer.length) {
    _appendRows(sheet, buffer);
    totalWritten += buffer.length;
  }

  props.deleteProperty('tracking_checkpoint');
  if (currentMax > maxKnownId) props.setProperty('MAX_KNOWN_TRACKING_ID', String(currentMax));
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ تمت مزامنة ' + totalWritten + ' حالة تتبع جديدة', 'مزامنة التتبع', 5);
  return totalWritten;
}

// ──────────────────────────────────────────────
//  3. DASHBOARD
// ──────────────────────────────────────────────

function _classifyStatus(status) {
  var s = (status || '').toString().toLowerCase().trim();
  var M = CONFIG.STATUS_MAP;
  if (M.delivered.some(function(k) { return s.indexOf(k) !== -1; })) return 'delivered';
  if (M.returned.some(function(k) { return s.indexOf(k) !== -1; })) return 'returned';
  if (M.transit.some(function(k) { return s.indexOf(k) !== -1; })) return 'transit';
  if (M.delivery.some(function(k) { return s.indexOf(k) !== -1; })) return 'delivery';
  return 'others';
}

function _computeMetrics(ordersSheet, trackingSheet, tz, todayStr) {
  var m = {
    ordersToday: 0, revenueToday: 0,
    totalOrders: 0, totalRevenue: 0,
    totalTracking: 0, trackingRevenue: 0,
    delivered: 0, returned: 0,
    inTransit: 0, inDelivery: 0, others: 0,
    wilayas: {}, products: {}, agents: {}, months: {}
  };

  if (ordersSheet && ordersSheet.getLastRow() > 1) {
    var oData = ordersSheet.getRange(2, 1, ordersSheet.getLastRow() - 1, 10).getValues();
    for (var oi = 0; oi < oData.length; oi++) {
      var row = oData[oi];
      var dateRaw = row[1];
      var total = Number(row[7] || 0);
      var dateStr = '';
      if (dateRaw instanceof Date && !isNaN(dateRaw)) {
        dateStr = Utilities.formatDate(dateRaw, tz, 'yyyy-MM-dd');
      } else {
        var cleanStr = String(dateRaw || '').trim().split('T')[0].split(' ')[0];
        if (cleanStr.length >= 10) dateStr = cleanStr.substring(0, 10);
      }
      if (dateStr === todayStr || String(dateRaw).indexOf(todayStr) !== -1) {
        m.ordersToday++;
        m.revenueToday += total;
      }
    }
  }

  if (trackingSheet && trackingSheet.getLastRow() > 1) {
    var tData = trackingSheet.getRange(2, 1, trackingSheet.getLastRow() - 1, 10).getValues();
    m.totalTracking = tData.length;
    for (var ti = 0; ti < tData.length; ti++) {
      var tr = tData[ti];
      var dateRaw = tr[1];
      var agent = (tr[2] || '').toString().trim();
      var wilaya = (tr[4] || '').toString().trim();
      var status = (tr[5] || '').toString();
      var product = (tr[6] || '').toString().trim();
      var total = Number(tr[7] || 0);
      var delivery = Number(tr[8] || 0);

      m.totalOrders++;
      m.totalRevenue += total;

      var cls = _classifyStatus(status);
      if (cls === 'delivered') { m.delivered++; m.trackingRevenue += (total - delivery); }
      else if (cls === 'returned') { m.returned++; }
      else if (cls === 'transit') { m.inTransit++; }
      else if (cls === 'delivery') { m.inDelivery++; }
      else { m.others++; }

      if (agent) m.agents[agent] = (m.agents[agent] || 0) + 1;
      if (wilaya) m.wilayas[wilaya] = (m.wilayas[wilaya] || 0) + 1;
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ordersSheet = ss.getSheetByName('Orders');
  var trackingSheet = ss.getSheetByName('Tracking');
  var dashSheet = ss.getSheetByName('Dashboard');

  if (!dashSheet) {
    ss.toast('❌ شيت Dashboard غير موجود!', 'خطأ', 5);
    return;
  }

  var tz = Session.getScriptTimeZone();
  var today = new Date();
  var todayStr = Utilities.formatDate(today, tz, 'yyyy-MM-dd');

  var m = _computeMetrics(ordersSheet, trackingSheet, tz, todayStr);

  dashSheet.clearContents();
  dashSheet.clearFormats();
  dashSheet.getCharts().forEach(function(c) { dashSheet.removeChart(c); });

  // Header
  dashSheet.getRange('A1:O1').merge()
    .setValue('📊 لوحة التحكم التنفيذية — ' + Utilities.formatDate(today, tz, 'dd/MM/yyyy HH:mm'))
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#0f172a').setFontColor('#ffffff');
  dashSheet.setRowHeight(1, 40);

  // Section titles
  var sections = [
    ['A2', 'B2', '💰 مؤشرات الأداء الرئيسية', '#1e3a8a', '#dbeafe'],
    ['D2', 'E2', '🗺️ أعلى 15 ولاية طلباً', '#065f46', '#d1fae5'],
    ['G2', 'H2', '🔥 أعلى 10 منتجات', '#7c2d12', '#fee2e2'],
    ['J2', 'K2', '👤 أداء الوكلاء', '#4c1d95', '#ede9fe'],
    ['M2', 'O2', '📅 تقرير الأشهر (آخر 6)', '#1e40af', '#bfdbfe'],
  ];
  for (var si = 0; si < sections.length; si++) {
    var s = sections[si];
    dashSheet.getRange(s[0] + ':' + s[1]).merge()
      .setValue(s[2]).setFontSize(10).setFontWeight('bold')
      .setHorizontalAlignment('center').setBackground(s[3]).setFontColor(s[4]);
  }
  dashSheet.setRowHeight(2, 28);

  // Column headers
  var colHeaders = [
    ['A3', 'المؤشر'], ['B3', 'القيمة'],
    ['D3', 'الولاية'], ['E3', 'الطلبيات'],
    ['G3', 'المنتج'], ['H3', 'الطلبيات'],
    ['J3', 'الوكيل'], ['K3', 'الطلبات المؤكدة'],
    ['M3', 'الشهر'], ['N3', 'الطلبيات'], ['O3', 'المداخيل'],
  ];
  for (var ci = 0; ci < colHeaders.length; ci++) {
    dashSheet.getRange(colHeaders[ci][0])
      .setValue(colHeaders[ci][1]).setFontWeight('bold')
      .setBackground('#e2e8f0').setHorizontalAlignment('center');
  }
  dashSheet.setRowHeight(3, 24);

  // KPIs
  var avgOrder = m.totalOrders > 0 ? (m.totalRevenue / m.totalOrders) : 0;
  var deliveryRate = m.totalTracking > 0 ? (m.delivered / m.totalTracking) : 0;
  var returnRate = m.totalTracking > 0 ? (m.returned / m.totalTracking) : 0;
  var pendingOrders = m.inTransit + m.inDelivery;

  var kpis = [
    ['📅 طلبات اليوم', m.ordersToday, '#,##0'],
    ['💵 مداخيل اليوم', m.revenueToday, '#,##0" DA"'],
    ['📊 إجمالي الطلبات', m.totalOrders, '#,##0'],
    ['📈 إجمالي المبيعات', m.totalRevenue, '#,##0" DA"'],
    ['💵 متوسط قيمة الطلب', avgOrder, '#,##0" DA"'],
    ['📦 إجمالي المشحون', m.totalTracking, '#,##0'],
    ['💸 صافي الأرباح (Livré)', m.trackingRevenue, '#,##0" DA"'],
    ['✅ مسلمة (Livré)', m.delivered, '#,##0'],
    ['❌ مرجعة (Retour/Refus)', m.returned, '#,##0'],
    ['⏳ في الطريق (Transit)', m.inTransit, '#,##0'],
    ['🚚 قيد التوصيل (Livraison)', m.inDelivery, '#,##0'],
    ['⚙️ أخرى / معالجة', m.others, '#,##0'],
    ['📉 نسبة التسليم', deliveryRate, '0.00%'],
    ['📤 نسبة الإرجاع', returnRate, '0.00%'],
    ['🔄 طلبات في الانتظار', pendingOrders, '#,##0'],
  ];

  for (var ki = 0; ki < kpis.length; ki++) {
    var row = ki + 4;
    var bg = ki % 2 === 0 ? '#f8fafc' : '#ffffff';
    dashSheet.getRange(row, 1).setValue(kpis[ki][0]).setFontSize(9).setHorizontalAlignment('right').setBackground(bg);
    var vCell = dashSheet.getRange(row, 2);
    vCell.setValue(kpis[ki][1]).setFontWeight('bold').setNumberFormat(kpis[ki][2]).setHorizontalAlignment('center').setBackground(bg);
  }

  dashSheet.setColumnWidth(1, 230);
  dashSheet.setColumnWidth(2, 140);

  // Top 15 Wilayas
  var wilayaKeys = Object.keys(m.wilayas).sort(function(a, b) { return m.wilayas[b] - m.wilayas[a]; }).slice(0, 15);
  for (var wi = 0; wi < wilayaKeys.length; wi++) {
    var wr = wi + 4;
    dashSheet.getRange(wr, 4).setValue(wilayaKeys[wi]).setBackground(wi % 2 === 0 ? '#f0fdf4' : '#ffffff').setHorizontalAlignment('right');
    dashSheet.getRange(wr, 5).setValue(m.wilayas[wilayaKeys[wi]]).setBackground(wi % 2 === 0 ? '#f0fdf4' : '#ffffff').setHorizontalAlignment('center').setFontWeight('bold').setNumberFormat('#,##0');
  }

  // Top 10 Products
  var productKeys = Object.keys(m.products).sort(function(a, b) { return m.products[b] - m.products[a]; }).slice(0, 10);
  for (var pi = 0; pi < productKeys.length; pi++) {
    var pr = pi + 4;
    dashSheet.getRange(pr, 7).setValue(productKeys[pi]).setBackground(pi % 2 === 0 ? '#fff7ed' : '#ffffff').setHorizontalAlignment('right');
    dashSheet.getRange(pr, 8).setValue(m.products[productKeys[pi]]).setBackground(pi % 2 === 0 ? '#fff7ed' : '#ffffff').setHorizontalAlignment('center').setFontWeight('bold').setNumberFormat('#,##0');
  }

  // Top 12 Agents
  var agentKeys = Object.keys(m.agents).sort(function(a, b) { return m.agents[b] - m.agents[a]; }).slice(0, 12);
  for (var ai = 0; ai < agentKeys.length; ai++) {
    var ar = ai + 4;
    var medal = ai === 0 ? '🥇 ' : ai === 1 ? '🥈 ' : ai === 2 ? '🥉 ' : '';
    dashSheet.getRange(ar, 10).setValue(medal + agentKeys[ai]).setBackground(ai % 2 === 0 ? '#f5f3ff' : '#ffffff').setHorizontalAlignment('right');
    dashSheet.getRange(ar, 11).setValue(m.agents[agentKeys[ai]]).setBackground(ai % 2 === 0 ? '#f5f3ff' : '#ffffff').setHorizontalAlignment('center').setFontWeight('bold').setNumberFormat('#,##0');
  }

  // Last 6 months
  var monthKeys = Object.keys(m.months).sort().slice(-6);
  for (var mi = 0; mi < monthKeys.length; mi++) {
    var mr = mi + 4;
    var md = m.months[monthKeys[mi]];
    var mbg = mi % 2 === 0 ? '#eff6ff' : '#ffffff';
    dashSheet.getRange(mr, 13).setValue(monthKeys[mi]).setBackground(mbg).setHorizontalAlignment('center');
    dashSheet.getRange(mr, 14).setValue(md.count).setBackground(mbg).setHorizontalAlignment('center').setFontWeight('bold').setNumberFormat('#,##0');
    dashSheet.getRange(mr, 15).setValue(md.revenue).setBackground(mbg).setHorizontalAlignment('center').setFontWeight('bold').setNumberFormat('#,##0" DA"');
  }

  // Pie chart data
  var pieData = dashSheet.getRange('Z90:AA94');
  pieData.setValues([
    ['المسلمة', m.delivered],
    ['المرجعة', m.returned],
    ['في الطريق', m.inTransit],
    ['قيد التوصيل', m.inDelivery],
    ['أخرى', m.others],
  ]);

  dashSheet.insertChart(dashSheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(pieData)
    .setPosition(4, 17, 0, 0)
    .setOption('title', 'نسب حالات الشحن')
    .setOption('is3D', true)
    .setOption('width', 420).setOption('height', 280)
    .setOption('slices', {0: {color:'#10b981'}, 1: {color:'#ef4444'}, 2: {color:'#f59e0b'}, 3: {color:'#3b82f6'}, 4: {color:'#94a3b8'}})
    .build());

  if (wilayaKeys.length > 0) {
    dashSheet.insertChart(dashSheet.newChart()
      .setChartType(Charts.ChartType.BAR)
      .addRange(dashSheet.getRange(3, 4, wilayaKeys.length + 1, 2))
      .setPosition(19, 17, 0, 0)
      .setOption('title', 'توزيع الطلبيات حسب الولاية')
      .setOption('colors', ['#1e3a8a']).setOption('legend', {position:'none'})
      .setOption('width', 420).setOption('height', 320)
      .build());
  }

  SpreadsheetApp.getActiveSpreadsheet().toast('✅ تم بناء لوحة البيانات بنجاح', 'لوحة البيانات', 5);
}

// ──────────────────────────────────────────────
//  4. FILTERS
// ──────────────────────────────────────────────

function setupFiltersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fSheet = ss.getSheetByName('Filters');
  if (!fSheet) fSheet = ss.insertSheet('Filters');

  fSheet.clearContents();
  fSheet.clearFormats();

  fSheet.getRange('A1:D1').merge()
    .setValue('🔍 لوحة الفلترة الشاملة — اختر الفلاتر ثم اضغط زر التقرير')
    .setFontSize(13).setFontWeight('bold')
    .setBackground('#0f172a').setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  fSheet.setRowHeight(1, 38);

  var filterLabels = [
    ['B3', '🗺️ الولاية (Wilaya)'],
    ['B4', '👤 الوكيل (Agent)'],
    ['B5', '📦 المنتج (Product)'],
    ['B6', '📅 تاريخ البداية (YYYY-MM-DD)'],
    ['B7', '📅 تاريخ النهاية (YYYY-MM-DD)'],
  ];
  for (var fi = 0; fi < filterLabels.length; fi++) {
    fSheet.getRange(filterLabels[fi][0]).setValue(filterLabels[fi][1])
      .setFontWeight('bold').setHorizontalAlignment('right').setBackground('#e2e8f0');
  }

  fSheet.getRange('C3:C7').setBackground('#fefce8').setHorizontalAlignment('center')
    .setBorder(true, true, true, true, false, false, '#94a3b8', SpreadsheetApp.BorderStyle.SOLID);
  fSheet.getRange('C3').setValue('الكل');
  fSheet.getRange('C4').setValue('الكل');
  fSheet.getRange('C5').setValue('الكل');
  fSheet.getRange('C6').setValue('');
  fSheet.getRange('C7').setValue('');

  refreshFilterDropdowns();

  fSheet.getRange('B9:D9').merge().setValue('💡 اترك الحقل فارغاً أو اكتب "الكل" لعدم تطبيق فلتر على هذا الحقل.').setFontSize(9).setFontColor('#64748b').setHorizontalAlignment('center');
  fSheet.getRange('B10:D10').merge().setValue('▶️ بعد الاختيار، شغّل الدالة: buildFilteredReport() من القائمة').setFontSize(9).setFontWeight('bold').setFontColor('#1d4ed8').setHorizontalAlignment('center');

  fSheet.setColumnWidth(2, 220);
  fSheet.setColumnWidth(3, 200);
  ss.toast('✅ تم إعداد شيت الفلاتر', 'الفلاتر', 3);
}

function refreshFilterDropdowns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fSheet = ss.getSheetByName('Filters');
  if (!fSheet) return;

  var trackingSheet = ss.getSheetByName('Tracking');
  var wilayas = [], agents = [], products = [];

  if (trackingSheet && trackingSheet.getLastRow() > 1) {
    var data = trackingSheet.getRange(2, 1, trackingSheet.getLastRow() - 1, 10).getValues();
    var wSet = {}, aSet = {}, pSet = {};
    for (var i = 0; i < data.length; i++) {
      var w = (data[i][4] || '').toString().trim();
      var a = (data[i][2] || '').toString().trim();
      var p = (data[i][6] || '').toString().trim();
      if (w) wSet[w] = true;
      if (a) aSet[a] = true;
      if (p) pSet[p] = true;
    }
    wilayas = Object.keys(wSet).sort();
    agents = Object.keys(aSet).sort();
    products = Object.keys(pSet).sort();
  }

  var all = ['الكل'];
  var mkRule = function(list) {
    return SpreadsheetApp.newDataValidation().requireValueInList(all.concat(list), true).setAllowInvalid(true).build();
  };
  fSheet.getRange('C3').setDataValidation(mkRule(wilayas));
  fSheet.getRange('C4').setDataValidation(mkRule(agents));
  fSheet.getRange('C5').setDataValidation(mkRule(products));
}

function buildFilteredReport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fSheet = ss.getSheetByName('Filters');
  if (!fSheet) {
    SpreadsheetApp.getUi().alert('❌ شيت Filters غير موجود! شغّل setupFiltersSheet() أولاً.');
    return;
  }

  var filterWilaya = fSheet.getRange('C3').getValue().toString().trim();
  var filterAgent = fSheet.getRange('C4').getValue().toString().trim();
  var filterProduct = fSheet.getRange('C5').getValue().toString().trim();
  var filterStart = fSheet.getRange('C6').getValue().toString().trim();
  var filterEnd = fSheet.getRange('C7').getValue().toString().trim();

  var useWilaya = filterWilaya && filterWilaya !== 'الكل';
  var useAgent = filterAgent && filterAgent !== 'الكل';
  var useProduct = filterProduct && filterProduct !== 'الكل';
  var useStart = filterStart.length === 10;
  var useEnd = filterEnd.length === 10;

  var trackingSheet = ss.getSheetByName('Tracking');
  if (!trackingSheet || trackingSheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('❌ شيت Tracking فارغ!');
    return;
  }

  var tz = Session.getScriptTimeZone();
  var data = trackingSheet.getRange(2, 1, trackingSheet.getLastRow() - 1, 10).getValues();
  var filtered = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var dateRaw = row[1];
    var agent = (row[2] || '').toString().trim();
    var wilaya = (row[4] || '').toString().trim();
    var product = (row[6] || '').toString().trim();

    var dateStr = '';
    if (dateRaw instanceof Date && !isNaN(dateRaw)) {
      dateStr = Utilities.formatDate(dateRaw, tz, 'yyyy-MM-dd');
    } else {
      dateStr = String(dateRaw || '').split('T')[0].split(' ')[0].substring(0, 10);
    }

    if (useWilaya && wilaya !== filterWilaya) continue;
    if (useAgent && agent !== filterAgent) continue;
    if (useProduct && product !== filterProduct) continue;
    if (useStart && dateStr < filterStart) continue;
    if (useEnd && dateStr > filterEnd) continue;

    filtered.push(row);
  }

  var viewSheet = ss.getSheetByName('FilteredView');
  if (!viewSheet) viewSheet = ss.insertSheet('FilteredView');
  viewSheet.clearContents();
  viewSheet.clearFormats();

  var titleParts = [];
  if (useWilaya) titleParts.push('ولاية: ' + filterWilaya);
  if (useAgent) titleParts.push('وكيل: ' + filterAgent);
  if (useProduct) titleParts.push('منتج: ' + filterProduct);
  if (useStart) titleParts.push('من: ' + filterStart);
  if (useEnd) titleParts.push('إلى: ' + filterEnd);
  var title = titleParts.length > 0 ? titleParts.join(' | ') : 'جميع السجلات (بدون فلتر)';

  viewSheet.getRange('A1:J1').merge()
    .setValue('📋 تقرير مُفلتر (Tracking) — ' + title)
    .setFontSize(12).setFontWeight('bold')
    .setBackground('#1e3a8a').setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  viewSheet.setRowHeight(1, 36);

  var colH = ['Order ID', 'التاريخ', 'الوكيل', 'العميل', 'الولاية', 'الحالة', 'المنتج', 'الإجمالي', 'الشحن', 'السائق'];
  viewSheet.getRange(2, 1, 1, 10).setValues([colH]).setFontWeight('bold').setBackground('#dbeafe').setHorizontalAlignment('center');

  if (filtered.length > 0) {
    viewSheet.getRange(3, 1, filtered.length, 10).setValues(filtered);
    viewSheet.getRange(3, 8, filtered.length, 1).setNumberFormat('#,##0" DA"');
    viewSheet.getRange(3, 9, filtered.length, 1).setNumberFormat('#,##0" DA"');
    for (var fi = 0; fi < filtered.length; fi++) {
      viewSheet.getRange(fi + 3, 1, 1, 10).setBackground(fi % 2 === 0 ? '#f8fafc' : '#ffffff');
    }
  } else {
    viewSheet.getRange('A3:J3').merge().setValue('⚠️ لا توجد نتائج تطابق الفلاتر المحددة.').setHorizontalAlignment('center').setFontColor('#dc2626').setFontSize(11);
  }

  var summaryRow = filtered.length + 5;
  var totalFiltered = filtered.length;
  var revFiltered = filtered.reduce(function(s, r) { return s + Number(r[7] || 0); }, 0);
  var avgFiltered = totalFiltered > 0 ? revFiltered / totalFiltered : 0;
  var tDelivered = 0, tReturned = 0, tInProgress = 0;
  filtered.forEach(function(r) {
    var cls = _classifyStatus(r[5]);
    if (cls === 'delivered') tDelivered++;
    else if (cls === 'returned') tReturned++;
    else tInProgress++;
  });

  var summaryData = [
    ['📊 ملخص التقرير المُفلتر', ''],
    ['عدد السجلات', totalFiltered],
    ['إجمالي المداخيل', revFiltered],
    ['متوسط قيمة الطلب', avgFiltered],
    ['✅ مسلمة', tDelivered],
    ['❌ مرجعة', tReturned],
    ['🔄 قيد المعالجة', tInProgress],
  ];
  viewSheet.getRange(summaryRow, 1, summaryData.length, 2).setValues(summaryData);
  viewSheet.getRange(summaryRow, 1, 1, 2).merge().setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff').setHorizontalAlignment('center');

  ss.setActiveSheet(viewSheet);
  SpreadsheetApp.getUi().alert('✅ تم إنشاء التقرير!\n\n📊 النتائج: ' + totalFiltered + ' سجل');
}

// ──────────────────────────────────────────────
//  5. UPDATE ALL
// ──────────────────────────────────────────────

function updateAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('🔄 بدء التحديث الكامل...', 'تحديث', 3);

  try { syncOrdersWithReturn(); } catch (e) { ss.toast('❌ فشلت مزامنة الطلبات: ' + e.message, 'خطأ', 10); }
  try { syncTrackingWithReturn(); } catch (e) { ss.toast('❌ فشلت مزامنة التتبع: ' + e.message, 'خطأ', 10); }
  try { buildDashboard(); } catch (e) { ss.toast('❌ فشل بناء لوحة البيانات: ' + e.message, 'خطأ', 10); }
  try { refreshFilterDropdowns(); } catch (e) { /* non-critical */ }

  ss.toast('✅ تم التحديث الكامل', 'تحديث', 5);
}

function resetAllProperties() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  Logger.log('✅ تم مسح كل الـ Properties');
}
