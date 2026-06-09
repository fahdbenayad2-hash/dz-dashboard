/**
 * DZ Commerce Intelligence — Google Apps Script v3
 * - Orders + Tracking: incremental fetch → cache hidden sheet → write sorted
 * - Dashboard: removed
 * - updateAll() يكون نقطة الدخول الوحيدة
 */

// ──────────────────────────────────────────────
//  CONFIG
// ──────────────────────────────────────────────

var CONFIG = {
  BASE_URL: 'https://femmesoir.leaderscod.com',
  TOKEN: '',
  X_AUTH: '',

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

  // أسماء شيتات الـ cache
  ORDERS_CACHE:   '_cache_orders',
  TRACKING_CACHE: '_cache_tracking',

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
  var r  = ui.prompt('🔑 أدخل التوكن الجديد (JWT):');
  if (r.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('JWT_TOKEN', r.getResponseText().trim());
    ui.alert('✅ تم حفظ التوكن');
  }
}

function setXAuth() {
  var ui = SpreadsheetApp.getUi();
  var r  = ui.prompt('🔑 أدخل مفتاح X-AUTH:');
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
    'Authorization':   'Bearer ' + getToken(),
    'x-authorization': getXAuth(),
    'lang':            'ar',
    'Accept':          'application/json',
    'Content-Type':    'application/json',
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
      if (code === 401) throw new Error('توكن غير صالح');
      if (code >= 500)  throw new Error('خطأ في الخادم: ' + code);
    } catch (e) {
      if (attempt === CONFIG.MAX_RETRIES - 1) throw e;
      Utilities.sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

// ──────────────────────────────────────────────
//  CACHE HELPERS
// ──────────────────────────────────────────────

/**
 * يجيب أو يبني شيت الـ cache (hidden).
 * العمود الأول دايماً هو Order ID كـ key.
 */
function getCacheSheet_(name) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.hideSheet();
  }
  return sheet;
}

/**
 * يقرأ الـ cache ويرجع Map: orderId → rowArray
 */
function readCache_(sheet) {
  var map = {};
  if (sheet.getLastRow() < 2) return map;
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    if (key) map[key] = data[i];
  }
  return map;
}

/**
 * يكتب الـ cache كامل (header + rows)
 * يمسح القديم ويكتب الجديد دفعة واحدة
 */
function writeCache_(sheet, headers, rowsMap) {
  sheet.clearContents();
  // header
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  // rows
  var rows = Object.values(rowsMap);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  SpreadsheetApp.flush();
}

/**
 * يكتب البيانات المرتبة في الشيت الظاهر للمستخدم
 * يمسح القديم ثم يكتب header + rows مرتبة
 */
function writeVisible_(name, headers, rowsMap) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  sheet.clearContents();
  sheet.clearFormats();

  // Header
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground('#0f172a')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Rows — مرتبة من الأحدث للأقدم حسب Order ID
  var rows = Object.values(rowsMap).sort(function(a, b) {
    return Number(b[0]) - Number(a[0]);
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  SpreadsheetApp.flush();
  return rows.length;
}

// ──────────────────────────────────────────────
//  1. SYNC ORDERS — Incremental + Cache
// ──────────────────────────────────────────────

function syncOrders() {
  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var startTime = Date.now();
  var timeoutMs = CONFIG.TIMEOUT_MINUTES * 60 * 1000;

  ss.toast('📦 جاري جلب الطلبات...', 'مزامنة الطلبات', -1);

  // 1. قرأ الـ cache الحالي
  var cacheSheet = getCacheSheet_(CONFIG.ORDERS_CACHE);
  var cached     = readCache_(cacheSheet);
  var newCount   = 0;
  var page       = 0;
  var done       = false;

  // 2. جلب الصفحات — نوقفو كي نلقاو ID موجود في الـ cache
  while (!done) {
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
      var o   = data.data[i];
      var key = String(o.id).trim();

      // كي نلقاو ID موجود في الـ cache → كل ما بعده موجود → نوقفو
      if (cached[key]) {
        done = true;
        break;
      }

      cached[key] = [
        o.id,
        o.created_at || '',
        (o.customer && o.customer.fullname) || '',
        (o.customer && o.customer.phones && o.customer.phones[0] && o.customer.phones[0].phone) || '',
        (o.addrs && o.addrs.wilaya && o.addrs.wilaya.name) || '',
        (o.status_order && o.status_order.name) || '',
        (o.products_order && o.products_order[0] && o.products_order[0].product && o.products_order[0].product.name) || '',
        Number(o.order_total   || 0),
        Number(o.delivery_cost || 0),
        (o.agent && o.agent.fullname) || '',
      ];
      newCount++;
    }

    if (data.data.length < CONFIG.ORDERS_LIMIT) break;
    page++;
    Utilities.sleep(100);
  }

  // 3. احفظ الـ cache
  writeCache_(cacheSheet, CONFIG.ORDERS_HEADERS, cached);

  // 4. اكتب الشيت الظاهر مرتب
  var total = writeVisible_('Orders', CONFIG.ORDERS_HEADERS, cached);

  ss.toast(
    '✅ Orders: ' + total + ' إجمالي (' + newCount + ' جديد)',
    'مزامنة الطلبات', 5
  );
  return total;
}

// ──────────────────────────────────────────────
//  2. SYNC TRACKING — Incremental + Cache
// ──────────────────────────────────────────────

function syncTracking() {
  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var startTime = Date.now();
  var timeoutMs = CONFIG.TIMEOUT_MINUTES * 60 * 1000;

  ss.toast('📦 جاري جلب بيانات التتبع...', 'مزامنة التتبع', -1);

  // 1. قرأ الـ cache الحالي
  var cacheSheet = getCacheSheet_(CONFIG.TRACKING_CACHE);
  var cached     = readCache_(cacheSheet);
  var newCount   = 0;
  var page       = 0;
  var done       = false;

  // 2. جلب الصفحات
  while (!done) {
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
      var key  = String((item.order && item.order.id) || '').trim();
      if (!key) continue;

      // كي نلقاو ID موجود → نوقفو
      if (cached[key]) {
        done = true;
        break;
      }

      cached[key] = [
        key,
        item.date_and_time || '',
        (item.confirmed_by && item.confirmed_by.fullname) || '',
        (item.order && item.order.customer && item.order.customer.fullname) || '',
        (item.order && item.order.addrs && item.order.addrs.wilaya && item.order.addrs.wilaya.name) || '',
        item.tracking_status || '',
        (item.order && item.order.products_order && item.order.products_order[0] && item.order.products_order[0].product && item.order.products_order[0].product.name) || '',
        Number((item.order && item.order.order_total)   || 0),
        Number((item.order && item.order.delivery_cost) || 0),
        item.driver_name || '',
      ];
      newCount++;
    }

    if (!done) {
      if (data.all_count) {
        if ((page + 1) * CONFIG.TRACKING_LIMIT >= data.all_count) break;
      } else {
        if (data.data.length < CONFIG.TRACKING_LIMIT) break;
      }
    }

    page++;
    Utilities.sleep(200);
  }

  // 3. احفظ الـ cache
  writeCache_(cacheSheet, CONFIG.TRACKING_HEADERS, cached);

  // 4. اكتب الشيت الظاهر مرتب
  var total = writeVisible_('Tracking', CONFIG.TRACKING_HEADERS, cached);

  ss.toast(
    '✅ Tracking: ' + total + ' إجمالي (' + newCount + ' جديد)',
    'مزامنة التتبع', 5
  );
  return total;
}

// ──────────────────────────────────────────────
//  3. FILTERS
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
    ['B3', '🗺️ الولاية'],
    ['B4', '👤 الوكيل'],
    ['B5', '📦 المنتج'],
    ['B6', '📅 تاريخ البداية (YYYY-MM-DD)'],
    ['B7', '📅 تاريخ النهاية (YYYY-MM-DD)'],
  ].forEach(function(l) {
    fSheet.getRange(l[0]).setValue(l[1]).setFontWeight('bold')
      .setHorizontalAlignment('right').setBackground('#e2e8f0');
  });

  fSheet.getRange('C3:C7').setBackground('#fefce8').setHorizontalAlignment('center')
    .setBorder(true, true, true, true, false, false, '#94a3b8', SpreadsheetApp.BorderStyle.SOLID);
  ['الكل', 'الكل', 'الكل', '', ''].forEach(function(v, i) {
    fSheet.getRange('C' + (i + 3)).setValue(v);
  });

  refreshFilterDropdowns();
  fSheet.setColumnWidth(2, 230);
  fSheet.setColumnWidth(3, 200);
  ss.toast('✅ تم إعداد شيت الفلاتر', 'الفلاتر', 3);
}

function refreshFilterDropdowns() {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var fSheet        = ss.getSheetByName('Filters');
  var trackingSheet = ss.getSheetByName('Tracking');
  if (!fSheet) return;

  var wSet = {}, aSet = {}, pSet = {};
  if (trackingSheet && trackingSheet.getLastRow() > 1) {
    var data = trackingSheet.getRange(2, 1, trackingSheet.getLastRow() - 1, 10).getValues();
    data.forEach(function(row) {
      var w = (row[4] || '').toString().trim();
      var a = (row[2] || '').toString().trim();
      var p = (row[6] || '').toString().trim();
      if (w) wSet[w] = true;
      if (a) aSet[a] = true;
      if (p) pSet[p] = true;
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
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var fSheet        = ss.getSheetByName('Filters');
  var trackingSheet = ss.getSheetByName('Tracking');

  if (!fSheet)        { SpreadsheetApp.getUi().alert('❌ شيت Filters غير موجود!'); return; }
  if (!trackingSheet || trackingSheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('❌ شيت Tracking فارغ!'); return;
  }

  var fWilaya  = fSheet.getRange('C3').getValue().toString().trim();
  var fAgent   = fSheet.getRange('C4').getValue().toString().trim();
  var fProduct = fSheet.getRange('C5').getValue().toString().trim();
  var fStart   = fSheet.getRange('C6').getValue().toString().trim();
  var fEnd     = fSheet.getRange('C7').getValue().toString().trim();

  var tz   = Session.getScriptTimeZone();
  var data = trackingSheet.getRange(2, 1, trackingSheet.getLastRow() - 1, 10).getValues();

  var filtered = data.filter(function(row) {
    var dateStr = '';
    if (row[1] instanceof Date && !isNaN(row[1])) {
      dateStr = Utilities.formatDate(row[1], tz, 'yyyy-MM-dd');
    } else {
      dateStr = String(row[1] || '').split('T')[0].split(' ')[0].substring(0, 10);
    }
    if (fWilaya  !== 'الكل' && fWilaya  && (row[4] || '').toString().trim() !== fWilaya)  return false;
    if (fAgent   !== 'الكل' && fAgent   && (row[2] || '').toString().trim() !== fAgent)   return false;
    if (fProduct !== 'الكل' && fProduct && (row[6] || '').toString().trim() !== fProduct) return false;
    if (fStart.length === 10 && dateStr < fStart) return false;
    if (fEnd.length   === 10 && dateStr > fEnd)   return false;
    return true;
  });

  var viewSheet = ss.getSheetByName('FilteredView');
  if (!viewSheet) viewSheet = ss.insertSheet('FilteredView');
  viewSheet.clearContents(); viewSheet.clearFormats();

  var parts = [];
  if (fWilaya  !== 'الكل' && fWilaya)  parts.push('ولاية: ' + fWilaya);
  if (fAgent   !== 'الكل' && fAgent)   parts.push('وكيل: ' + fAgent);
  if (fProduct !== 'الكل' && fProduct) parts.push('منتج: ' + fProduct);
  if (fStart.length === 10)             parts.push('من: ' + fStart);
  if (fEnd.length   === 10)            parts.push('إلى: ' + fEnd);

  viewSheet.getRange('A1:J1').merge()
    .setValue('📋 تقرير مُفلتر — ' + (parts.length ? parts.join(' | ') : 'جميع السجلات'))
    .setFontSize(12).setFontWeight('bold')
    .setBackground('#1e3a8a').setFontColor('#ffffff').setHorizontalAlignment('center');
  viewSheet.setRowHeight(1, 36);

  viewSheet.getRange(2, 1, 1, 10)
    .setValues([['Order ID','التاريخ','الوكيل','العميل','الولاية','الحالة','المنتج','الإجمالي','الشحن','السائق']])
    .setFontWeight('bold').setBackground('#dbeafe').setHorizontalAlignment('center');

  if (filtered.length > 0) {
    viewSheet.getRange(3, 1, filtered.length, 10).setValues(filtered);
    viewSheet.getRange(3, 8, filtered.length, 1).setNumberFormat('#,##0" DA"');
    viewSheet.getRange(3, 9, filtered.length, 1).setNumberFormat('#,##0" DA"');
    filtered.forEach(function(_, fi) {
      viewSheet.getRange(fi + 3, 1, 1, 10).setBackground(fi % 2 === 0 ? '#f8fafc' : '#ffffff');
    });
  } else {
    viewSheet.getRange('A3:J3').merge()
      .setValue('⚠️ لا توجد نتائج.').setHorizontalAlignment('center').setFontColor('#dc2626');
  }

  // ملخص
  var tDel = 0, tRet = 0, tOther = 0;
  var revTotal = filtered.reduce(function(s, r) { return s + Number(r[7] || 0); }, 0);
  filtered.forEach(function(r) {
    var cls = _classifyStatus(r[5]);
    if      (cls === 'delivered') tDel++;
    else if (cls === 'returned')  tRet++;
    else                          tOther++;
  });

  var sRow = filtered.length + 5;
  viewSheet.getRange(sRow, 1, 7, 2).setValues([
    ['📊 ملخص', ''],
    ['عدد السجلات',       filtered.length],
    ['إجمالي المداخيل',   revTotal],
    ['متوسط قيمة الطلب',  filtered.length > 0 ? revTotal / filtered.length : 0],
    ['✅ مسلمة',          tDel],
    ['❌ مرجعة',          tRet],
    ['🔄 قيد المعالجة',  tOther],
  ]);
  viewSheet.getRange(sRow, 1, 1, 2).merge()
    .setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff').setHorizontalAlignment('center');

  SpreadsheetApp.flush();
  ss.setActiveSheet(viewSheet);
  SpreadsheetApp.getUi().alert('✅ التقرير جاهز\n\n📊 ' + filtered.length + ' سجل');
}

// ──────────────────────────────────────────────
//  4. UPDATE ALL (entry point للـ Trigger)
// ──────────────────────────────────────────────

function updateAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('🔄 بدء التحديث الكامل...', 'تحديث', 3);

  try { syncOrders();   } catch (e) { ss.toast('❌ Orders: '   + e.message, 'خطأ', 10); }
  try { syncTracking(); } catch (e) { ss.toast('❌ Tracking: ' + e.message, 'خطأ', 10); }
  try { refreshFilterDropdowns(); } catch (e) { /* non-critical */ }

  ss.toast('✅ تم التحديث الكامل', 'تحديث', 5);
}  
