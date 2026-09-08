/** Install alongside Authentication.gs and existing CONFIG. No trigger is created.
 * Requires Advanced Sheets service and verified DZ_PAGINATION_MODE=page|offset.
 * Run dzSyncTick, NOT the legacy updateAll/syncOrders/syncTracking.
 */
function dzPrepareShadowTest() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('DZ_SYNC_STATE')) throw new Error('EXISTING_RUN');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['Orders', 'Tracking'].forEach(function (name) {
    var target = ss.getSheetByName('_dz_test_' + name) || ss.insertSheet('_dz_test_' + name);
    target.getRange(1, 1, 1, 11).setValues([(name === 'Orders' ? CONFIG.ORDERS_HEADERS : CONFIG.TRACKING_HEADERS).concat(['ItemsRaw'])]);
  });
  props.setProperty('DZ_PAGINATION_MODE', 'page');
  props.setProperty('DZ_TARGET_PREFIX', '_dz_test_');
  console.log('SHADOW_TEST_READY');
}

function dzSyncProgress() {
  var props = PropertiesService.getScriptProperties();
  console.log(props.getProperty('DZ_SYNC_STATE') || props.getProperty('DZ_SYNC_LAST_SUCCESS') || 'NO_RUN');
}

function dzValidateShadowTest() {
  console.log(JSON.stringify(dzShadowReport_()));
}

function dzShadowReport_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var status = ss.getSheetByName('_dz_test_SyncStatus');
  if (!status) throw new Error('SHADOW_STATUS_MISSING');
  var statusRow = status.getRange(2, 1, 1, 3).getValues()[0];
  if (!statusRow[0] || statusRow[2] !== 'completed') throw new Error('SHADOW_NOT_COMPLETED');
  var report = { generation: String(statusRow[0]), status: String(statusRow[2]), sources: {} };
  ['Orders', 'Tracking'].forEach(function (name) {
    var sheet = ss.getSheetByName('_dz_test_' + name);
    if (!sheet) throw new Error('SHADOW_TARGET_MISSING');
    var count = Math.max(0, sheet.getLastRow() - 1);
    var ids = count ? sheet.getRange(2, 1, count, 1).getValues() : [];
    var seen = Object.create(null), duplicates = 0, blanks = 0;
    ids.forEach(function (row) {
      var id = String(row[0] || '');
      if (!id) blanks++;
      else if (seen[id]) duplicates++;
      else seen[id] = true;
    });
    report.sources[name] = { rows: count, duplicateIds: duplicates, blankIds: blanks };
  });
  return report;
}

function dzPromoteValidatedShadow() {
  var report = dzShadowReport_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var requests = [];
  ['Orders', 'Tracking'].forEach(function (name) {
    var check = report.sources[name];
    if (!check || check.rows < 1 || check.duplicateIds || check.blankIds) throw new Error('SHADOW_VALIDATION_FAILED');
    var source = ss.getSheetByName('_dz_test_' + name), target = ss.getSheetByName(name);
    if (!source || !target) throw new Error('PROMOTION_TARGET_MISSING');
    var height = source.getLastRow();
    requests.push({ updateSheetProperties: { properties: { sheetId: target.getSheetId(), gridProperties: { rowCount: height, columnCount: Math.max(11, target.getMaxColumns()) } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } });
    requests.push({ copyPaste: { source: { sheetId: source.getSheetId(), startRowIndex: 0, endRowIndex: height, startColumnIndex: 0, endColumnIndex: 11 }, destination: { sheetId: target.getSheetId(), startRowIndex: 0, endRowIndex: height, startColumnIndex: 0, endColumnIndex: 11 }, pasteType: 'PASTE_VALUES' } });
  });
  var status = ss.getSheetByName('SyncStatus') || ss.insertSheet('SyncStatus');
  var values = [['Generation', 'CompletedAt', 'Status'], [report.generation, new Date().toISOString(), 'completed']];
  requests.push({ updateCells: { start: { sheetId: status.getSheetId(), rowIndex: 0, columnIndex: 0 }, rows: values.map(function (row) { return { values: row.map(function (v) { return { userEnteredValue: { stringValue: v } }; }) }; }), fields: 'userEnteredValue' } });
  SpreadsheetApp.flush();
  Sheets.Spreadsheets.batchUpdate({ requests: requests }, ss.getId());
  console.log('PROMOTION_COMPLETED generation=' + report.generation + ' orders=' + report.sources.Orders.rows + ' tracking=' + report.sources.Tracking.rows);
}

function dzPageProgress_(data, cursor, received, limit, mode, expected) {
  if (!data || !Array.isArray(data.data) || data.data.length > limit) throw new Error('INVALID_PAGE');
  var total = data.all_count === undefined || data.all_count === null ? null : Number(data.all_count);
  if (total !== null && (!Number.isInteger(total) || total < 0)) throw new Error('INVALID_COUNT');
  if (expected !== null && total !== null && total < expected) throw new Error('SOURCE_SHRANK_RESTART_REQUIRED');
  if (expected !== null && total !== null && total > expected) expected = total;
  if (expected === null) expected = total;
  var count = received + data.data.length;
  var done = data.data.length < limit;
  if (!done && data.data.length === 0) throw new Error('PREMATURE_END');
  return { cursor: cursor + (mode === 'page' ? 1 : data.data.length), received: count, expected: expected, done: done };
}

function dzMapRow_(name, item) {
  var o = name === 'Orders' ? item : item.order;
  if (!o || !o.id) throw new Error('MISSING_ORDER_ID');
  var customer = o.customer || {}, addr = o.addrs || {};
  var products = o.products_order || [];
  if (!Array.isArray(products)) throw new Error('INVALID_ITEMS');
  var product = products.length > 1 ? '[سلة متعددة المنتجات]' : ((products[0] && products[0].product && products[0].product.name) || '');
  var total = Number(o.order_total), delivery = Number(o.delivery_cost || 0);
  if (!isFinite(total) || !isFinite(delivery)) throw new Error('INVALID_AMOUNT');
  var row = name === 'Orders' ? [o.id, o.created_at || '', customer.fullname || '',
    (customer.phones && customer.phones[0] && customer.phones[0].phone) || '',
    (addr.wilaya && addr.wilaya.name) || '', (o.status_order && o.status_order.name) || '', product, total, delivery, (o.agent && o.agent.fullname) || ''] :
    [o.id, item.date_and_time || '', (item.confirmed_by && item.confirmed_by.fullname) || '', customer.fullname || '',
    (addr.wilaya && addr.wilaya.name) || '', item.tracking_status || '', product, total, delivery, item.driver_name || ''];
  // Preserve all original line-item fields for a later verified quantity/price adapter.
  row.push(JSON.stringify(products));
  return row.map(function (v) { return typeof v === 'string' && /^[\s]*[=+@-]/.test(v) ? "'" + v : v; });
}

function dzMergeRows_(fresh, archive) {
  var seen = Object.create(null), merged = [];
  fresh.forEach(function (row) {
    var id = String(row[0]);
    if (!id) throw new Error('MISSING_SOURCE_ID');
    // New records can shift page boundaries during a long run. Keep the first
    // occurrence (the newest snapshot) and continue until the short final page.
    if (seen[id]) return;
    seen[id] = true; merged.push(row);
  });
  archive.forEach(function (row) {
    var id = String(row[0]);
    if (id && !seen[id]) { seen[id] = true; merged.push(row.slice(0, 11).concat(Array(Math.max(0, 11 - row.length)).fill(''))); }
  });
  return merged.sort(function (a, b) { return Number(b[0]) - Number(a[0]); });
}

function dzSyncTick() {
  var props = PropertiesService.getScriptProperties();
  var mode = props.getProperty('DZ_PAGINATION_MODE');
  if (mode !== 'page' && mode !== 'offset') throw new Error('VERIFY_PAGINATION_MODE_FIRST');
  var targetMode = props.getProperty('DZ_TARGET_PREFIX') || 'production';
  if (targetMode !== 'production' && targetMode !== '_dz_test_') throw new Error('INVALID_TARGET_PREFIX');
  var targetPrefix = targetMode === 'production' ? '' : targetMode;
  // Document lock is distinct from Authentication.gs script lock.
  var lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(1000)) throw new Error('SYNC_BUSY_OR_NOT_BOUND');
  var ss = SpreadsheetApp.getActiveSpreadsheet(), start = Date.now();
  try {
    var state = JSON.parse(props.getProperty('DZ_SYNC_STATE') || 'null');
    if (!state) {
      state = { generation: Utilities.getUuid(), startedAt: new Date().toISOString(), mode: mode, targetPrefix: targetPrefix, sources: {} };
      props.setProperty('DZ_SYNC_STATE', JSON.stringify(state));
    }
      ['Orders', 'Tracking'].forEach(function (name) {
        if (state.sources[name]) return;
        var stageName = '_dz_' + name + '_' + state.generation.slice(0, 8);
        var sheet = ss.getSheetByName(stageName) || ss.insertSheet(stageName);
        var headers = (name === 'Orders' ? CONFIG.ORDERS_HEADERS : CONFIG.TRACKING_HEADERS).concat(['ItemsRaw']);
        sheet.getRange(1, 1, 1, 11).setValues([headers]); sheet.hideSheet();
        state.sources[name] = { sheetId: sheet.getSheetId(), cursor: 0, received: 0, expected: null, done: false, limit: name === 'Tracking' ? Number(props.getProperty('DZ_TRACKING_BATCH') || CONFIG.TRACKING_LIMIT) : CONFIG.ORDERS_LIMIT };
        props.setProperty('DZ_SYNC_STATE', JSON.stringify(state));
      });
    if (state.mode !== mode) throw new Error('PAGINATION_CHANGED_RESTART_REQUIRED');
    if ((state.targetPrefix || '') !== targetPrefix) throw new Error('TARGET_CHANGED_RESTART_REQUIRED');
    if (Date.now() - new Date(state.startedAt).getTime() > 24 * 3600000) throw new Error('RUN_EXPIRED_RESTART_REQUIRED');
    for (var sourceIndex = 0; sourceIndex < 2; sourceIndex++) {
      var name = ['Orders', 'Tracking'][sourceIndex], progress = state.sources[name];
      var stage = ss.getSheetById(progress.sheetId);
      if (!stage) throw new Error('STAGING_MISSING');
      var limit = progress.limit || (name === 'Orders' ? CONFIG.ORDERS_LIMIT : CONFIG.TRACKING_LIMIT);
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('INVALID_BATCH_LIMIT');
      var endpoint = name === 'Orders' ? CONFIG.ORDERS_ENDPOINT : CONFIG.TRACKING_ENDPOINT;
      while (!progress.done && Date.now() - start < 120000) {
        var data = apiGet_(endpoint, { offset: progress.cursor, limit: limit });
        var next = dzPageProgress_(data, progress.cursor, progress.received, limit, mode, progress.expected);
        var rows = data.data.map(function (item) { return dzMapRow_(name, item); });
        if (rows.length) {
          var required = progress.received + rows.length + 1;
          if (stage.getMaxRows() < required) stage.insertRowsAfter(stage.getMaxRows(), required - stage.getMaxRows());
          // Deterministic range: retry overwrites a page if execution died before checkpoint.
          stage.getRange(progress.received + 2, 1, rows.length, 11).setValues(rows);
          SpreadsheetApp.flush();
        }
        Object.keys(next).forEach(function (key) { progress[key] = next[key]; });
        props.setProperty('DZ_SYNC_STATE', JSON.stringify(state));
      }
      if (!progress.done) return;
    }
    // Publication is a separate bounded execution, never after a long fetch pass.
    if (Date.now() - start > 30000) return;
    dzPublish_(ss, state);
    props.setProperty('DZ_SYNC_LAST_SUCCESS', JSON.stringify({ generation: state.generation, completedAt: new Date().toISOString() }));
    props.deleteProperty('DZ_SYNC_ERROR');
    props.deleteProperty('DZ_SYNC_STATE');
  } catch (_) {
    var reason = String(_.message || '');
    var safeCode = /^[A-Z_]+$/.test(reason) ? reason : (/timed out/i.test(reason) ? 'GOOGLE_SHEETS_TIMEOUT' : 'UPSTREAM_ERROR');
    console.log('SYNC_ERROR_CODE=' + safeCode);
    props.setProperty('DZ_SYNC_ERROR', JSON.stringify({ at: new Date().toISOString(), code: 'SYNC_FAILED_REVIEW_EXECUTION' }));
    throw new Error('SYNC_FAILED: last published data retained; inspect configuration, pagination and staging');
  } finally { lock.releaseLock(); }
}

function dzPublish_(ss, state) {
  var prefix = state.targetPrefix || '';
  var props = PropertiesService.getScriptProperties();
  var existing = ss.getSheetByName(prefix + 'SyncStatus');
  if (existing && existing.getRange(2, 1, 1, 3).getValues()[0][0] === state.generation) return;
  var requests = [];
  ['Orders', 'Tracking'].forEach(function (name) {
    var progress = state.sources[name];
    if (!progress.done) throw new Error('INCOMPLETE_RUN');
    var target = ss.getSheetByName(prefix + name);
    if (!target) throw new Error('TARGET_MISSING');
    var publish = progress.publishSheetId ? ss.getSheetById(progress.publishSheetId) : null;
    var height = Number(progress.publishHeight || 0);
    if (!publish || !Number.isInteger(height) || height < 1) {
      var stage = ss.getSheetById(progress.sheetId);
      if (!stage) throw new Error('STAGING_MISSING');
      var fresh = progress.received ? stage.getRange(2, 1, progress.received, 11).getValues() : [];
      var archiveSheet = ss.getSheetByName(name === 'Orders' ? '_archive_orders' : '_archive_tracking');
      var archive = archiveSheet && archiveSheet.getLastRow() > 1 ? archiveSheet.getRange(2, 1, archiveSheet.getLastRow() - 1, 10).getValues() : [];
      var merged = dzMergeRows_(fresh, archive);
      // Unexpected large drops need an explicit investigation before publication.
      if (target.getLastRow() > 100 && merged.length < (target.getLastRow() - 1) * 0.8) throw new Error('UNEXPECTED_COUNT_DROP');
      height = Math.max(merged.length + 1, target.getLastRow(), stage.getMaxRows());
      // Keep original page staging immutable, including on publication retries.
      var headers = stage.getRange(1, 1, 1, 11).getValues()[0];
      var publishName = '_dz_publish_' + name + '_' + state.generation.slice(0, 8);
      publish = ss.getSheetByName(publishName) || ss.insertSheet(publishName);
      if (publish.getMaxRows() < height) publish.insertRowsAfter(publish.getMaxRows(), height - publish.getMaxRows());
      publish.getRange(1, 1, height, 11).clearContent();
      publish.getRange(1, 1, merged.length + 1, 11).setValues([headers].concat(merged));
      publish.hideSheet();
      SpreadsheetApp.flush();
      progress.publishSheetId = publish.getSheetId();
      progress.publishHeight = height;
      props.setProperty('DZ_SYNC_STATE', JSON.stringify(state));
    }
    requests.push({ updateSheetProperties: { properties: { sheetId: target.getSheetId(), gridProperties: { rowCount: Math.max(height, target.getMaxRows()), columnCount: Math.max(11, target.getMaxColumns()) } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } });
    requests.push({ copyPaste: { source: { sheetId: publish.getSheetId(), startRowIndex: 0, endRowIndex: height, startColumnIndex: 0, endColumnIndex: 11 }, destination: { sheetId: target.getSheetId(), startRowIndex: 0, endRowIndex: height, startColumnIndex: 0, endColumnIndex: 11 }, pasteType: 'PASTE_VALUES' } });
  });
  var status = ss.getSheetByName(prefix + 'SyncStatus') || ss.insertSheet(prefix + 'SyncStatus');
  var values = [['Generation', 'CompletedAt', 'Status'], [state.generation, new Date().toISOString(), 'completed']];
  requests.push({ updateCells: { start: { sheetId: status.getSheetId(), rowIndex: 0, columnIndex: 0 }, rows: values.map(function (row) { return { values: row.map(function (v) { return { userEnteredValue: { stringValue: v } }; }) }; }), fields: 'userEnteredValue' } });
  SpreadsheetApp.flush();
  // Google Sheets batchUpdate applies both datasets and generation metadata atomically.
  Sheets.Spreadsheets.batchUpdate({ requests: requests }, ss.getId());
  // Old staging is intentionally retained for recovery. Review and remove old _dz_ generations after backup.
}
