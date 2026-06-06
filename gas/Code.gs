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
  BASE_URL: 'https://leaderscod.com',
  TOKEN: '', // set via ScriptProperties or menu
  ORDERS_ENDPOINT: '/tenants/api/CashOutRequests/getAll',
  TRACKING_ENDPOINT: '/tenants/api/tracking-order',
  BATCH_SIZE: 500,
  TIMEOUT_MINUTES: 5,
  MAX_RETRIES: 3,
  STATUS_MAP: {
    // Arabic shipping statuses → 4 categories
    'livré':        'تم التوصيل',
    'livrée':       'تم التوصيل',
    'livrer':       'تم التوصيل',
    'terminé':      'تم التوصيل',
    'terminer':     'تم التوصيل',
    'retour':       'مرتجع',
    'retourné':     'مرتجع',
    'retourner':    'مرتجع',
    'en cours':     'قيد التوصيل',
    'en transit':   'قيد التوصيل',
    'transit':      'قيد التوصيل',
    'en livraison': 'قيد التوصيل',
    'livraison':    'قيد التوصيل',
    'preparation':  'قيد التوصيل',
    'en préparation':'قيد التوصيل',
    'annulé':       'ملغي',
    'annuler':      'ملغي',
    'annulation':   'ملغي',
    'non confirmé': 'ملغي',
    'en attente':   'معلق',
    'attente':      'معلق',
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
    .addToUi();
}

function setToken() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt('🔑 أدخل التوكن الجديد:');
  if (response.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('JWT_TOKEN', response.getResponseText().trim());
    CONFIG.TOKEN = response.getResponseText().trim();
    ui.alert('✅ تم حفظ التوكن بنجاح');
  }
}

function getToken() {
  if (CONFIG.TOKEN) return CONFIG.TOKEN;
  var stored = PropertiesService.getScriptProperties().getProperty('JWT_TOKEN');
  if (stored) CONFIG.TOKEN = stored;
  return stored || '';
}

// ──────────────────────────────────────────────
//  HEADERS
// ──────────────────────────────────────────────

function buildHeaders_() {
  var token = getToken();
  return {
    'Authorization': 'Bearer ' + token,
    'x-authorization': token,
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

// ──────────────────────────────────────────────
//  1. SYNC ORDERS (Incremental)
// ──────────────────────────────────────────────

function syncOrdersWithReturn() {
  var sheet = ensureSheet_('Orders', ['Order ID', 'Date', 'Customer', 'Phone', 'Wilaya', 'Status', 'Product', 'Total', 'Delivery', 'Agent']);
  var maxId = getMaxId_(sheet, 1);
  var props = PropertiesService.getScriptProperties();
  var page = 1;
  var totalWritten = 0;
  var startTime = Date.now();
  var timeoutMs = CONFIG.TIMEOUT_MINUTES * 60 * 1000;
  var lastId = maxId;

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      props.setProperty('orders_checkpoint', JSON.stringify({ page: page, lastId: lastId }));
      SpreadsheetApp.getActiveSpreadsheet().toast('⏰ انتهى الوقت. توقف عند الصفحة ' + page + '. شغّل المزامنة مرة أخرى للاستئناف.', 'مزامنة الطلبات', 10);
      break;
    }

    var data;
    try {
      data = apiGet_(CONFIG.ORDERS_ENDPOINT, { page: page, limit: CONFIG.BATCH_SIZE });
    } catch (e) {
      SpreadsheetApp.getActiveSpreadsheet().toast('❌ ' + e.message, 'خطأ', 10);
      throw e;
    }

    if (!data || !data.records || data.records.length === 0) break;

    var newRows = [];
    for (var i = 0; i < data.records.length; i++) {
      var r = data.records[i];
      var id = Number(r.id) || 0;
      if (id <= lastId) continue;
      newRows.push([
        id,
        r.createdAt || r.date || '',
        r.customerName || r.customer || '',
        r.phone || '',
        r.wilaya || '',
        r.status || '',
        r.product || '',
        Number(r.total) || 0,
        Number(r.delivery_cost) || Number(r.delivery) || 0,
        r.agentName || r.agent || '',
      ]);
    }

    if (newRows.length > 0) {
      var lastRow = sheet.getLastRow();
      var targetRange = sheet.getRange(lastRow + 1, 1, newRows.length, 10);
      targetRange.setValues(newRows);
      totalWritten += newRows.length;
      var ids = newRows.map(function(row) { return row[0]; });
      lastId = Math.max.apply(null, ids);
    }

    if (data.records.length < CONFIG.BATCH_SIZE) break;
    page++;
  }

  props.deleteProperty('orders_checkpoint');
  props.setProperty('MAX_KNOWN_ORDER_ID', String(lastId));
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ تمت مزامنة ' + totalWritten + ' طلب جديد', 'مزامنة الطلبات', 5);
  return totalWritten;
}

// ──────────────────────────────────────────────
//  2. SYNC TRACKING (Incremental)
// ──────────────────────────────────────────────

function syncTrackingWithReturn() {
  var sheet = ensureSheet_('Tracking', ['Tracking ID', 'Order ID', 'Status', 'Date', 'Wilaya', 'Note']);
  var maxId = getMaxId_(sheet, 1);
  var props = PropertiesService.getScriptProperties();
  var page = 1;
  var totalWritten = 0;
  var startTime = Date.now();
  var timeoutMs = CONFIG.TIMEOUT_MINUTES * 60 * 1000;
  var lastId = maxId;
  var checkpoint = props.getProperty('tracking_checkpoint');
  if (checkpoint) {
    var cp = JSON.parse(checkpoint);
    page = cp.page || 1;
    lastId = cp.lastId || lastId;
  }

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      props.setProperty('tracking_checkpoint', JSON.stringify({ page: page, lastId: lastId }));
      SpreadsheetApp.getActiveSpreadsheet().toast('⏰ انتهى وقت التتبع. استأنف بتشغيل المزامنة مرة أخرى.', 'مزامنة التتبع', 10);
      break;
    }

    var data;
    try {
      data = apiGet_(CONFIG.TRACKING_ENDPOINT, { page: page, limit: CONFIG.BATCH_SIZE });
    } catch (e) {
      SpreadsheetApp.getActiveSpreadsheet().toast('❌ ' + e.message, 'خطأ', 10);
      throw e;
    }

    if (!data || !data.records || data.records.length === 0) break;

    var newRows = [];
    for (var i = 0; i < data.records.length; i++) {
      var r = data.records[i];
      var id = Number(r.id) || 0;
      if (id <= lastId) continue;
      newRows.push([
        id,
        Number(r.order_id) || Number(r.orderId) || 0,
        r.status || '',
        r.date || r.createdAt || '',
        r.wilaya || '',
        r.note || '',
      ]);
    }

    if (newRows.length > 0) {
      var lastRow = sheet.getLastRow();
      var targetRange = sheet.getRange(lastRow + 1, 1, newRows.length, 6);
      targetRange.setValues(newRows);
      totalWritten += newRows.length;
      var ids = newRows.map(function(row) { return row[0]; });
      lastId = Math.max.apply(null, ids);
    }

    if (data.records.length < CONFIG.BATCH_SIZE) break;
    page++;
  }

  props.deleteProperty('tracking_checkpoint');
  props.setProperty('MAX_KNOWN_TRACKING_ID', String(lastId));
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ تمت مزامنة ' + totalWritten + ' حالة تتبع جديدة', 'مزامنة التتبع', 5);
  return totalWritten;
}

// ──────────────────────────────────────────────
//  3. DASHBOARD
// ──────────────────────────────────────────────

function _classifyStatus(status) {
  if (!status) return 'معلق';
  var s = status.toString().trim().toLowerCase();
  return CONFIG.STATUS_MAP[s] || 'أخرى';
}

function buildDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ordersSheet = ss.getSheetByName('Orders');
  var trackingSheet = ss.getSheetByName('Tracking');
  if (!ordersSheet) throw new Error('❌ ورقة "Orders" غير موجودة. شغّل مزامنة الطلبات أولاً.');

  // ── Read Orders ──
  var ordersData = ordersSheet.getDataRange().getValues();
  var orders = [];
  for (var i = 1; i < ordersData.length; i++) {
    orders.push({
      id: ordersData[i][0],
      date: ordersData[i][1],
      customer: ordersData[i][2],
      phone: ordersData[i][3],
      wilaya: ordersData[i][4],
      status: ordersData[i][5],
      product: ordersData[i][6],
      total: Number(ordersData[i][7]) || 0,
      delivery: Number(ordersData[i][8]) || 0,
      agent: ordersData[i][9],
    });
  }

  // ── Read Tracking ──
  var trackingMap = {};
  if (trackingSheet) {
    var trackData = trackingSheet.getDataRange().getValues();
    for (var t = 1; t < trackData.length; t++) {
      var orderId = Number(trackData[t][1]) || 0;
      if (!trackingMap[orderId]) trackingMap[orderId] = [];
      trackingMap[orderId].push({
        id: trackData[t][0],
        status: _classifyStatus(trackData[t][2]),
        date: trackData[t][3],
        wilaya: trackData[t][4],
        note: trackData[t][5],
      });
    }
  }

  // ── Compute KPIs ──
  var totalOrders = orders.length;
  var totalRevenue = 0;
  var confirmedCount = 0;
  var failedCount = 0;
  var pendingCount = 0;
  var waitingCount = 0;
  var totalDeliveryFees = 0;
  var productMap = {};
  var wilayaMap = {};
  var agentMap = {};
  var monthlyMap = {};

  for (var o = 0; o < orders.length; o++) {
    var order = orders[o];
    var status = order.status.toString().trim();

    if (status === 'مؤكدة' || status === 'Confirmed') {
      confirmedCount++;
      totalRevenue += order.total;
      totalDeliveryFees += order.delivery;
    } else if (status === 'فاشلة' || status === 'فاشلة 01' || status === 'فاشلة 02' || status === 'Failed') {
      failedCount++;
    } else if (status === 'قيد الانتظار' || status === 'Pending') {
      pendingCount++;
    } else {
      waitingCount++;
    }

    // Product aggregation
    if (order.product) {
      productMap[order.product] = (productMap[order.product] || 0) + 1;
    }

    // Wilaya aggregation
    if (order.wilaya) {
      wilayaMap[order.wilaya] = (wilayaMap[order.wilaya] || 0) + 1;
    }

    // Agent aggregation
    if (order.agent) {
      if (!agentMap[order.agent]) agentMap[order.agent] = { total: 0, confirmed: 0, revenue: 0 };
      agentMap[order.agent].total++;
      if (status === 'مؤكدة' || status === 'Confirmed') {
        agentMap[order.agent].confirmed++;
        agentMap[order.agent].revenue += order.total;
      }
    }

    // Monthly aggregation (last 6 months)
    if (order.date) {
      var d = new Date(order.date);
      if (!isNaN(d.getTime())) {
        var monthKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { orders: 0, confirmed: 0, revenue: 0, failed: 0 };
        monthlyMap[monthKey].orders++;
        if (status === 'مؤكدة' || status === 'Confirmed') {
          monthlyMap[monthKey].confirmed++;
          monthlyMap[monthKey].revenue += order.total;
        }
        if (status === 'فاشلة' || status === 'فاشلة 01' || status === 'فاشلة 02' || status === 'Failed') {
          monthlyMap[monthKey].failed++;
        }
      }
    }
  }

  var cancellationRate = totalOrders > 0 ? (failedCount / totalOrders) * 100 : 0;
  var confirmedRate = totalOrders > 0 ? (confirmedCount / totalOrders) * 100 : 0;
  var avgOrderValue = confirmedCount > 0 ? totalRevenue / confirmedCount : 0;
  var netAfterDelivery = totalRevenue - totalDeliveryFees;

  // ── Tracking KPIs ──
  var deliveredCount = 0;
  var returnedCount = 0;
  var inTransitCount = 0;
  var cancelledCount = 0;
  var trackingRevenue = 0;

  if (trackingSheet) {
    for (var tr = 1; tr < trackData.length; tr++) {
      var tStatus = _classifyStatus(trackData[tr][2]);
      if (tStatus === 'تم التوصيل') {
        deliveredCount++;
        var tOrderId = Number(trackData[tr][1]) || 0;
        if (tOrderId) {
          var tOrder = orders.find(function(o) { return Number(o.id) === tOrderId; });
          if (tOrder && (tOrder.status === 'مؤكدة' || tOrder.status === 'Confirmed')) {
            trackingRevenue += tOrder.total - tOrder.delivery;
          }
        }
      } else if (tStatus === 'مرتجع') {
        returnedCount++;
      } else if (tStatus === 'قيد التوصيل') {
        inTransitCount++;
      } else if (tStatus === 'ملغي') {
        cancelledCount++;
      }
    }
  }

  var deliveryRate = (deliveredCount + returnedCount) > 0 ? (deliveredCount / (deliveredCount + returnedCount)) * 100 : 0;
  var returnRate = (deliveredCount + returnedCount) > 0 ? (returnedCount / (deliveredCount + returnedCount)) * 100 : 0;

  // ── Top 15 Wilayas ──
  var wilayaSorted = Object.keys(wilayaMap).sort(function(a, b) { return wilayaMap[b] - wilayaMap[a]; }).slice(0, 15);

  // ── Top 10 Products ──
  var productSorted = Object.keys(productMap).sort(function(a, b) { return productMap[b] - productMap[a]; }).slice(0, 10);

  // ── Top 12 Agents with medals ──
  var agentSorted = Object.keys(agentMap).sort(function(a, b) { return agentMap[b].confirmed - agentMap[a].confirmed; });
  var topAgents = agentSorted.slice(0, 12);
  function agentMedal(index) {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return (index + 1) + '.';
  }

  // ── Last 6 Months (sorted) ──
  var monthKeys = Object.keys(monthlyMap).sort();
  var last6 = monthKeys.slice(-6);

  // ── Build Dashboard sheet ──
  var dash = ensureSheet_('Dashboard', []);
  dash.clear();

  // Title
  dash.getRange('A1').setValue('📊 لوحة بيانات المبيعات');
  dash.getRange('A1').setFontSize(20).setFontWeight('bold');
  dash.mergeCells('A1:H1');
  dash.getRange('A1').setHorizontalAlignment('center');
  dash.getRange('A2').setFormula('="آخر تحديث: " & NOW()');
  dash.getRange('A2').setFontSize(10).setFontColor('#666666');
  dash.mergeCells('A2:H2');
  dash.getRange('A2').setHorizontalAlignment('center');

  // ── KPI Row (Row 4) ──
  var kpiHeaders = ['العدد الإجمالي', 'الإيراد الإجمالي', 'المؤكدة', '% الإلغاء', 'متوسط الطلب', 'صافي بعد الشحن', '% التوصيل', '% المرتجعات', 'تم التوصيل', 'مرتجع', 'قيد التوصيل', 'ملغي', 'الطلبات/اليوم', 'إيراد التتبع'];
  for (var kh = 0; kh < kpiHeaders.length; kh++) {
    var cell = dash.getRange(4, kh + 1);
    cell.setValue(kpiHeaders[kh]);
    cell.setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  }

  var todayOrders = 0;
  var todayStr = Utilities.formatDate(new Date(), 'Africa/Algiers', 'yyyy-MM-dd');
  for (var to = 0; to < orders.length; to++) {
    if (orders[to].date && orders[to].date.indexOf(todayStr) === 0) todayOrders++;
  }

  var kpiValues = [
    totalOrders,
    totalRevenue,
    confirmedCount,
    cancellationRate.toFixed(1) + '%',
    Math.round(avgOrderValue),
    netAfterDelivery,
    deliveryRate.toFixed(1) + '%',
    returnRate.toFixed(1) + '%',
    deliveredCount,
    returnedCount,
    inTransitCount,
    cancelledCount,
    todayOrders,
    Math.round(trackingRevenue),
  ];
  for (var kv = 0; kv < kpiValues.length; kv++) {
    var vCell = dash.getRange(5, kv + 1);
    vCell.setValue(kpiValues[kv]);
    vCell.setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
    var colLetter = String.fromCharCode(65 + kv);
    dash.getRange(colLetter + '4:' + colLetter + '5').setBorder(true, true, true, true, false, false);
  }

  // ── Chart 1: Shipping Status PIE (Row 7) ──
  var pieLabels = ['تم التوصيل', 'مرتجع', 'قيد التوصيل', 'ملغي', 'معلق'];
  var pieValues = [deliveredCount, returnedCount, inTransitCount, cancelledCount, 0];
  for (var pi = 7; pi <= 7 + pieLabels.length - 1; pi++) {
    dash.getRange(pi, 1).setValue(pieLabels[pi - 7]);
    dash.getRange(pi, 2).setValue(pieValues[pi - 7]);
  }
  dash.getRange('A6:B6').setValues([['حالة الشحن', 'العدد']]);
  dash.getRange('A6:B6').setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');

  var pieChart = dash.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(dash.getRange('A7:B11'))
    .setPosition(7, 4, 0, 0)
    .setOption('title', 'توزيع حالات الشحن')
    .setOption('pieSliceText', 'label')
    .setOption('width', 400).setOption('height', 280)
    .build();
  dash.insertChart(pieChart);

  // ── Chart 2: Top 15 Wilayas BAR ──
  for (var w = 0; w < wilayaSorted.length; w++) {
    dash.getRange(7 + w, 7).setValue(wilayaSorted[w]);
    dash.getRange(7 + w, 8).setValue(wilayaMap[wilayaSorted[w]]);
  }
  dash.getRange('F6:G6').setValues([['الولاية', 'العدد']]);
  dash.getRange('F6:G6').setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');

  var barChart = dash.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(dash.getRange('F7:G21'))
    .setPosition(7, 9, 0, 0)
    .setOption('title', 'أفضل 15 ولاية')
    .setOption('width', 500).setOption('height', 350)
    .setOption('hAxis', { title: 'عدد الطلبات' })
    .setOption('vAxis', { title: 'الولاية' })
    .build();
  dash.insertChart(barChart);

  // ── Chart 3: Top 10 Products COLUMN ──
  for (var p = 0; p < productSorted.length; p++) {
    dash.getRange(7 + p, 12).setValue(productSorted[p]);
    dash.getRange(7 + p, 13).setValue(productMap[productSorted[p]]);
  }
  dash.getRange('L6:M6').setValues([['المنتج', 'العدد']]);
  dash.getRange('L6:M6').setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');

  var colChart = dash.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(dash.getRange('L7:M16'))
    .setPosition(22, 1, 0, 0)
    .setOption('title', 'أفضل 10 منتجات')
    .setOption('width', 600).setOption('height', 300)
    .setOption('hAxis', { title: 'المنتج', textStyle: { fontSize: 9 } })
    .setOption('vAxis', { title: 'عدد الطلبات' })
    .build();
  dash.insertChart(colChart);

  // ── Chart 4: Monthly Trend LINE (last 6 months) ──
  for (var m = 0; m < last6.length; m++) {
    var mo = monthlyMap[last6[m]];
    dash.getRange(7 + m, 15).setValue(last6[m]);
    dash.getRange(7 + m, 16).setValue(mo.orders);
    dash.getRange(7 + m, 17).setValue(mo.confirmed);
    dash.getRange(7 + m, 18).setValue(mo.revenue);
  }
  dash.getRange('O6:R6').setValues([['الشهر', 'الطلبات', 'المؤكدة', 'الإيراد']]);
  dash.getRange('O6:R6').setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');

  var lineChart = dash.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(dash.getRange('O7:R12'))
    .setPosition(22, 8, 0, 0)
    .setOption('title', 'الاتجاه الشهري (آخر 6 أشهر)')
    .setOption('width', 600).setOption('height', 300)
    .setOption('curveType', 'function')
    .setOption('legend', { position: 'bottom' })
    .build();
  dash.insertChart(lineChart);

  // ── Top 12 Agents Table (Row 30) ──
  dash.getRange('A30:D30').setValues([['الوكيل', 'الطلبات', 'المؤكدة', 'الإيراد']]);
  dash.getRange('A30:D30').setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
  for (var a = 0; a < topAgents.length; a++) {
    var ag = agentMap[topAgents[a]];
    dash.getRange(31 + a, 1).setValue(agentMedal(a) + ' ' + topAgents[a]);
    dash.getRange(31 + a, 2).setValue(ag.total);
    dash.getRange(31 + a, 3).setValue(ag.confirmed);
    dash.getRange(31 + a, 4).setValue(ag.revenue);
  }

  // ── Formatting ──
  dash.getRange('A1:H2').setHorizontalAlignment('center');
  dash.setColumnWidths(1, 18, 140);
  dash.getDataRange().setVerticalAlignment('middle');

  SpreadsheetApp.getActiveSpreadsheet().toast('✅ تم بناء لوحة البيانات بنجاح', 'لوحة البيانات', 5);
}

// ──────────────────────────────────────────────
//  4. FILTERS
// ──────────────────────────────────────────────

function setupFiltersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var filterSheet = ss.getSheetByName('Filters');
  if (!filterSheet) {
    filterSheet = ss.insertSheet('Filters');
  } else {
    filterSheet.clear();
  }

  filterSheet.getRange('A1').setValue('🔍 تصفية البيانات').setFontSize(16).setFontWeight('bold');
  filterSheet.mergeCells('A1:D1');
  filterSheet.getRange('A1').setHorizontalAlignment('center');

  filterSheet.getRange('A3').setValue('الولاية');
  filterSheet.getRange('A4').setValue('الوكيل');
  filterSheet.getRange('A5').setValue('المنتج');
  filterSheet.getRange('A6').setValue('من تاريخ');
  filterSheet.getRange('A7').setValue('إلى تاريخ');

  filterSheet.getRange('A3:A7').setFontWeight('bold').setBackground('#f0f0f0');

  // Default date range = last 30 days
  var now = new Date();
  var thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  filterSheet.getRange('B3').setValue('الكل');
  filterSheet.getRange('B4').setValue('الكل');
  filterSheet.getRange('B5').setValue('الكل');
  filterSheet.getRange('B6').setValue(Utilities.formatDate(thirtyAgo, 'Africa/Algiers', 'yyyy-MM-dd'));
  filterSheet.getRange('B7').setValue(Utilities.formatDate(now, 'Africa/Algiers', 'yyyy-MM-dd'));

  refreshFilterDropdowns();

  filterSheet.getRange('B3:B7').setBorder(true, true, true, true, false, false);
  filterSheet.setColumnWidths(1, 2, 150);

  ss.toast('✅ تم إعداد ورقة الفلاتر', 'الفلاتر', 3);
}

function refreshFilterDropdowns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ordersSheet = ss.getSheetByName('Orders');
  var filterSheet = ss.getSheetByName('Filters');
  if (!ordersSheet || !filterSheet) return;

  var data = ordersSheet.getDataRange().getValues();
  var wilayaSet = {};
  var agentSet = {};
  var productSet = {};

  for (var i = 1; i < data.length; i++) {
    if (data[i][4]) wilayaSet[data[i][4]] = true;
    if (data[i][9]) agentSet[data[i][9]] = true;
    if (data[i][6]) productSet[data[i][6]] = true;
  }

  var wilayas = ['الكل'].concat(Object.keys(wilayaSet).sort());
  var agents = ['الكل'].concat(Object.keys(agentSet).sort());
  var products = ['الكل'].concat(Object.keys(productSet).sort());

  var wilayaRule = SpreadsheetApp.newDataValidation().requireValueInList(wilayas, true).build();
  var agentRule = SpreadsheetApp.newDataValidation().requireValueInList(agents, true).build();
  var productRule = SpreadsheetApp.newDataValidation().requireValueInList(products, true).build();

  filterSheet.getRange('B3').setDataValidation(wilayaRule);
  filterSheet.getRange('B4').setDataValidation(agentRule);
  filterSheet.getRange('B5').setDataValidation(productRule);
}

// ──────────────────────────────────────────────
//  5. FILTERED REPORT
// ──────────────────────────────────────────────

function buildFilteredReport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ordersSheet = ss.getSheetByName('Orders');
  var trackingSheet = ss.getSheetByName('Tracking');
  var filterSheet = ss.getSheetByName('Filters');
  if (!ordersSheet || !filterSheet) throw new Error('❌ تأكد من وجود ورقة Orders و Filters');

  var filterWilaya = filterSheet.getRange('B3').getValue().toString().trim();
  var filterAgent = filterSheet.getRange('B4').getValue().toString().trim();
  var filterProduct = filterSheet.getRange('B5').getValue().toString().trim();
  var filterDateFrom = filterSheet.getRange('B6').getValue();
  var filterDateTo = filterSheet.getRange('B7').getValue();

  var ordersData = ordersSheet.getDataRange().getValues();
  var filteredOrders = [];
  var totalFilteredRevenue = 0;
  var totalFilteredDelivery = 0;
  var filteredConfirmed = 0;
  var filteredFailed = 0;
  var productFilterMap = {};
  var wilayaFilterMap = {};

  for (var i = 1; i < ordersData.length; i++) {
    var row = ordersData[i];
    var orderDate = row[1] ? row[1].toString() : '';

    if (filterWilaya !== 'الكل' && row[4] !== filterWilaya) continue;
    if (filterAgent !== 'الكل' && row[9] !== filterAgent) continue;
    if (filterProduct !== 'الكل' && row[6] !== filterProduct) continue;
    if (filterDateFrom && orderDate < filterDateFrom) continue;
    if (filterDateTo && orderDate > filterDateTo) continue;

    filteredOrders.push(row);
    var status = row[5].toString().trim();
    if (status === 'مؤكدة' || status === 'Confirmed') {
      totalFilteredRevenue += Number(row[7]) || 0;
      totalFilteredDelivery += Number(row[8]) || 0;
      filteredConfirmed++;
    }
    if (status === 'فاشلة' || status === 'فاشلة 01' || status === 'فاشلة 02' || status === 'Failed') {
      filteredFailed++;
    }

    if (row[6]) productFilterMap[row[6]] = (productFilterMap[row[6]] || 0) + 1;
    if (row[4]) wilayaFilterMap[row[4]] = (wilayaFilterMap[row[4]] || 0) + 1;
  }

  // ── Write FilteredView ──
  var fv = ensureSheet_('FilteredView', []);

  var fvHeaders = ['Order ID', 'Date', 'Customer', 'Phone', 'Wilaya', 'Status', 'Product', 'Total', 'Delivery', 'Agent'];
  fv.clear();

  // Summary
  fv.getRange('A1').setValue('📋 تقرير مفلتر').setFontSize(16).setFontWeight('bold');
  fv.mergeCells('A1:J1');
  fv.getRange('A1').setHorizontalAlignment('center');

  fv.getRange('A3').setValue('عدد الطلبات');
  fv.getRange('B3').setValue(filteredOrders.length);
  fv.getRange('A4').setValue('الإيراد');
  fv.getRange('B4').setValue(totalFilteredRevenue);
  fv.getRange('A5').setValue('المؤكدة');
  fv.getRange('B5').setValue(filteredConfirmed);
  fv.getRange('A6').setValue('الفاشلة');
  fv.getRange('B6').setValue(filteredFailed);
  fv.getRange('A7').setValue('متوسط الطلب');
  fv.getRange('B7').setValue(filteredConfirmed > 0 ? Math.round(totalFilteredRevenue / filteredConfirmed) : 0);
  fv.getRange('A8').setValue('صافي الإيراد');
  fv.getRange('B8').setValue(totalFilteredRevenue - totalFilteredDelivery);
  fv.getRange('A9').setValue('% الإلغاء');
  fv.getRange('B9').setValue(filteredOrders.length > 0 ? (filteredFailed / filteredOrders.length * 100).toFixed(1) + '%' : '0%');

  fv.getRange('A3:A9').setFontWeight('bold').setBackground('#f0f0f0');
  fv.getRange('B3:B9').setHorizontalAlignment('center').setFontWeight('bold');

  // Top products in filtered view
  var topProd = Object.keys(productFilterMap).sort(function(a, b) { return productFilterMap[b] - productFilterMap[a]; }).slice(0, 10);
  fv.getRange('D3').setValue('أفضل المنتجات').setFontWeight('bold').setFontSize(12);
  for (var tp = 0; tp < topProd.length; tp++) {
    fv.getRange(4 + tp, 4).setValue(topProd[tp]);
    fv.getRange(4 + tp, 5).setValue(productFilterMap[topProd[tp]]);
  }

  // Data table
  var dataStartRow = 12;
  fv.getRange(dataStartRow, 1, 1, 10).setValues([fvHeaders]);
  fv.getRange(dataStartRow, 1, 1, 10).setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');

  if (filteredOrders.length > 0) {
    var dataRows = [];
    for (var fr = 0; fr < filteredOrders.length; fr++) {
      dataRows.push(filteredOrders[fr]);
    }
    fv.getRange(dataStartRow + 1, 1, dataRows.length, 10).setValues(dataRows);
  }

  fv.getDataRange().setVerticalAlignment('middle');
  fv.setColumnWidths(1, 10, 120);

  ss.toast('✅ تم بناء التقرير المفلتر: ' + filteredOrders.length + ' طلب', 'التقرير المفلتر', 5);
}

// ──────────────────────────────────────────────
//  6. UPDATE ALL
// ──────────────────────────────────────────────

function updateAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('🔄 بدء التحديث الكامل...', 'تحديث', 3);

  try {
    syncOrdersWithReturn();
  } catch (e) {
    ss.toast('❌ فشلت مزامنة الطلبات: ' + e.message, 'خطأ', 10);
  }

  try {
    syncTrackingWithReturn();
  } catch (e) {
    ss.toast('❌ فشلت مزامنة التتبع: ' + e.message, 'خطأ', 10);
  }

  try {
    buildDashboard();
  } catch (e) {
    ss.toast('❌ فشل بناء لوحة البيانات: ' + e.message, 'خطأ', 10);
  }

  try {
    refreshFilterDropdowns();
  } catch (e) {
    // non-critical
  }

  ss.toast('✅ تم التحديث الكامل', 'تحديث', 5);
}
