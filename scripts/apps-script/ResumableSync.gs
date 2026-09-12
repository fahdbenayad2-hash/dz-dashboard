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
  // Octomatic is a live newest-first feed. Orders can be added, removed, or moved
  // between pages while a generation is running, so all_count is an observation,
  // not a stable snapshot boundary. The short final page remains authoritative.
  if (expected !== null && total !== null && total !== expected) console.log('SOURCE_COUNT_CHANGED=' + expected + '->' + total);
  if (expected !== null && total !== null) expected = total;
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

/**
 * Installs the single production trigger after removing older dzSyncTick clocks.
 * The live Octomatic probe accepts 500 Tracking rows but caps Orders at 50.
 */
function dzInstallSyncTrigger() {
  var props = PropertiesService.getScriptProperties();
  var minutes = Number(props.getProperty('DZ_SYNC_INTERVAL_MINUTES') || 30);
  if ([15, 30].indexOf(minutes) === -1) throw new Error('INVALID_SYNC_INTERVAL');
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'dzSyncTick') ScriptApp.deleteTrigger(trigger);
  });
  props.setProperty('DZ_TRACKING_BATCH', '500');
  ScriptApp.newTrigger('dzSyncTick').timeBased().everyMinutes(minutes).create();
  console.log('SYNC_TRIGGER_INSTALLED minutes=' + minutes + ' trackingBatch=500');
}

function dzStageName_(name, targetPrefix) {
  return '_dz_stage_' + (targetPrefix ? 'test_' : '') + name;
}

function dzPrepareStage_(ss, name, targetPrefix) {
  var stageName = dzStageName_(name, targetPrefix);
  var sheet = ss.getSheetByName(stageName) || ss.insertSheet(stageName);
  var headers = (name === 'Orders' ? CONFIG.ORDERS_HEADERS : CONFIG.TRACKING_HEADERS).concat(['ItemsRaw']);
  var headerRow = { values: headers.map(function (value) { return { userEnteredValue: { stringValue: String(value) } }; }) };
  Sheets.Spreadsheets.batchUpdate({ requests: [
    { updateSheetProperties: { properties: { sheetId: sheet.getSheetId(), gridProperties: { rowCount: 1, columnCount: 11 } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } },
    { updateCells: { start: { sheetId: sheet.getSheetId(), rowIndex: 0, columnIndex: 0 }, rows: [headerRow], fields: 'userEnteredValue' } }
  ] }, ss.getId());
  sheet.hideSheet();
  return sheet;
}

function dzPruneLegacyStaging_(ss, state) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('DZ_STAGING_MIGRATED') === 'true') return;
  var keep = Object.create(null);
  if (state && state.sources) Object.keys(state.sources).forEach(function (name) {
    var source = state.sources[name];
    if (source && source.sheetId) keep[String(source.sheetId)] = true;
  });
  var requests = [];
  ss.getSheets().forEach(function (sheet) {
    if (!/^_dz_(Orders|Tracking)_[A-Za-z0-9-]+$/.test(sheet.getName())) return;
    if (!keep[String(sheet.getSheetId())]) requests.push({ deleteSheet: { sheetId: sheet.getSheetId() } });
  });
  if (requests.length) Sheets.Spreadsheets.batchUpdate({ requests: requests }, ss.getId());
  if (requests.length) console.log('PRUNED_LEGACY_STAGING=' + requests.length);
  // Only a pass with no active legacy generation proves migration is complete.
  if (!state) props.setProperty('DZ_STAGING_MIGRATED', 'true');
}

function dzMarkStagingMigrationComplete() {
  PropertiesService.getScriptProperties().setProperty('DZ_STAGING_MIGRATED', 'true');
  console.log('STAGING_MIGRATION_MARKED_COMPLETE');
}

function dzWriteStageRows_(ss, stage, startRowIndex, rows, expected) {
  if (!rows.length) return;
  // Avoid SpreadsheetService grid reads, which time out on this large workbook.
  // Grow only to the durable checkpoint instead of reserving 20k rows per stage.
  var targetRows = Math.max(1, startRowIndex + rows.length);
  var requests = [{ updateSheetProperties: { properties: { sheetId: stage.getSheetId(), gridProperties: { rowCount: targetRows, columnCount: 11 } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } }];
  requests.push({ updateCells: {
    start: { sheetId: stage.getSheetId(), rowIndex: startRowIndex, columnIndex: 0 },
    rows: rows.map(function (row) { return { values: row.map(function (value) {
      return { userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: String(value === null || value === undefined ? '' : value) } };
    }) }; }),
    fields: 'userEnteredValue'
  } });
  Sheets.Spreadsheets.batchUpdate({ requests: requests }, ss.getId());
}

function dzCompactStaging() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var requests = [];
  ss.getSheets().forEach(function (sheet) {
    if (!/^_dz_(Orders|Tracking)_/.test(sheet.getName())) return;
    var rows = Math.max(1, sheet.getLastRow());
    if (sheet.getMaxRows() === rows && sheet.getMaxColumns() === 11) return;
    requests.push({ updateSheetProperties: {
      properties: { sheetId: sheet.getSheetId(), gridProperties: { rowCount: rows, columnCount: 11 } },
      fields: 'gridProperties.rowCount,gridProperties.columnCount'
    } });
  });
  if (requests.length) Sheets.Spreadsheets.batchUpdate({ requests: requests }, ss.getId());
  console.log('COMPACTED_STAGING_SHEETS=' + requests.length);
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
  var budgetMs = Number(props.getProperty('DZ_SYNC_BUDGET_MS') || 270000);
  if (!Number.isInteger(budgetMs) || budgetMs < 30000 || budgetMs > 270000) throw new Error('INVALID_SYNC_BUDGET');
  try {
    var state = JSON.parse(props.getProperty('DZ_SYNC_STATE') || 'null');
    // Older versions created two new staging sheets every generation. Remove all
    // obsolete generations before writing, while preserving a resumable active run.
    dzPruneLegacyStaging_(ss, state);
    if (!state) {
      state = { generation: Utilities.getUuid(), startedAt: new Date().toISOString(), mode: mode, targetPrefix: targetPrefix, sources: {} };
      props.setProperty('DZ_SYNC_STATE', JSON.stringify(state));
    }
      ['Orders', 'Tracking'].forEach(function (name) {
        if (state.sources[name]) return;
        // Stable stage names bound storage use to two sheets for production and
        // two for shadow tests, regardless of how many generations run.
        var sheet = dzPrepareStage_(ss, name, targetPrefix);
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
      var pagesPerWrite = Number(props.getProperty('DZ_STAGE_PAGES_PER_WRITE') || 10);
      if (!Number.isInteger(pagesPerWrite) || pagesPerWrite < 1 || pagesPerWrite > 20) throw new Error('INVALID_STAGE_PAGES_PER_WRITE');
      var endpoint = name === 'Orders' ? CONFIG.ORDERS_ENDPOINT : CONFIG.TRACKING_ENDPOINT;
      while (!progress.done && Date.now() - start < budgetMs) {
        var rows = [], next = { cursor: progress.cursor, received: progress.received, expected: progress.expected, done: progress.done };
        var fetchedPages = 0;
        while (!next.done && fetchedPages < pagesPerWrite && Date.now() - start < budgetMs - 5000) {
          var data = apiGet_(endpoint, { offset: next.cursor, limit: limit });
          var page = dzPageProgress_(data, next.cursor, next.received, limit, mode, next.expected);
          Array.prototype.push.apply(rows, data.data.map(function (item) { return dzMapRow_(name, item); }));
          next = page;
          fetchedPages++;
        }
        if (!fetchedPages) return;
        // One Advanced Sheets call persists several source pages. A retry starts at
        // the last durable chunk, preserving resumability while staying below quota.
        dzWriteStageRows_(ss, stage, progress.received + 1, rows, next.expected);
        Object.keys(next).forEach(function (key) { progress[key] = next[key]; });
        props.setProperty('DZ_SYNC_STATE', JSON.stringify(state));
      }
      if (!progress.done) return;
    }
    // Publication now runs entirely on the Sheets backend and stays bounded even
    // after a long fetch pass, so completed data does not wait for the next trigger.
    dzPublish_(ss, state);
    props.setProperty('DZ_SYNC_LAST_SUCCESS', JSON.stringify({ generation: state.generation, completedAt: new Date().toISOString() }));
    props.deleteProperty('DZ_SYNC_ERROR');
    props.deleteProperty('DZ_SYNC_STATE');
    // A migrated active run can still reference generation-specific stage sheets.
    // Delete them only after their publication completed successfully.
    dzPruneLegacyStaging_(ss, null);
  } catch (_) {
    var reason = String(_.message || '');
    var codeMatch = reason.match(/^([A-Z_]{2,})(?:\b|:)/);
    var safeCode = codeMatch ? codeMatch[1] : (/timed out/i.test(reason) ? 'GOOGLE_SHEETS_TIMEOUT' : 'UPSTREAM_ERROR');
    console.log('SYNC_ERROR_CODE=' + safeCode);
    props.setProperty('DZ_SYNC_ERROR', JSON.stringify({ at: new Date().toISOString(), code: safeCode }));
    // Configuration changes and expired generations cannot make progress from the
    // old checkpoint. Release only that checkpoint so the next trigger starts a
    // clean generation; the last published sheets remain untouched.
    if (/^(RUN_EXPIRED_RESTART_REQUIRED|PAGINATION_CHANGED_RESTART_REQUIRED|TARGET_CHANGED_RESTART_REQUIRED)$/.test(reason)) {
      props.deleteProperty('DZ_SYNC_STATE');
      props.setProperty('DZ_SYNC_LAST_RESTART', JSON.stringify({ at: new Date().toISOString(), code: safeCode }));
    }
    throw new Error('SYNC_FAILED: last published data retained; inspect configuration, pagination and staging');
  } finally { lock.releaseLock(); }
}

function dzPublish_(ss, state) {
  var prefix = state.targetPrefix || '';
  var existing = ss.getSheetByName(prefix + 'SyncStatus');
  if (existing && existing.getRange(2, 1, 1, 3).getValues()[0][0] === state.generation) return;
  var requests = [];
  ['Orders', 'Tracking'].forEach(function (name) {
    var progress = state.sources[name];
    if (!progress.done) throw new Error('INCOMPLETE_RUN');
    var target = ss.getSheetByName(prefix + name);
    if (!target) throw new Error('TARGET_MISSING');
    var stage = ss.getSheetById(progress.sheetId);
    if (!stage) throw new Error('STAGING_MISSING');
    var height = progress.received + 1;
    if (progress.expected !== null && progress.received < progress.expected) throw new Error('INCOMPLETE_COUNT');
    if (target.getLastRow() > 100 && height - 1 < (target.getLastRow() - 1) * 0.8) throw new Error('UNEXPECTED_COUNT_DROP');
    // The paginated stage already contains the complete source. Copy it on the
    // Sheets backend instead of reading and rewriting tens of thousands of cells
    // in Apps Script, which can exceed the execution limit before publication.
    requests.push({ updateSheetProperties: { properties: { sheetId: target.getSheetId(), gridProperties: { rowCount: height, columnCount: Math.max(11, target.getMaxColumns()) } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } });
    requests.push({ copyPaste: { source: { sheetId: stage.getSheetId(), startRowIndex: 0, endRowIndex: height, startColumnIndex: 0, endColumnIndex: 11 }, destination: { sheetId: target.getSheetId(), startRowIndex: 0, endRowIndex: height, startColumnIndex: 0, endColumnIndex: 11 }, pasteType: 'PASTE_VALUES' } });
    // Page boundaries may shift when new orders arrive during a long run. The
    // source is newest-first, so retaining the first ID keeps the newest copy.
    requests.push({ deleteDuplicates: { range: { sheetId: target.getSheetId(), startRowIndex: 1, endRowIndex: height, startColumnIndex: 0, endColumnIndex: 11 }, comparisonColumns: [{ sheetId: target.getSheetId(), dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }] } });
  });
  var status = ss.getSheetByName(prefix + 'SyncStatus') || ss.insertSheet(prefix + 'SyncStatus');
  var values = [['Generation', 'CompletedAt', 'Status'], [state.generation, new Date().toISOString(), 'completed']];
  requests.push({ updateCells: { start: { sheetId: status.getSheetId(), rowIndex: 0, columnIndex: 0 }, rows: values.map(function (row) { return { values: row.map(function (v) { return { userEnteredValue: { stringValue: v } }; }) }; }), fields: 'userEnteredValue' } });
  SpreadsheetApp.flush();
  // Google Sheets batchUpdate applies both datasets and generation metadata atomically.
  Sheets.Spreadsheets.batchUpdate({ requests: requests }, ss.getId());
  // Stable staging sheets are reset at the start of the next generation. Published
  // targets remain the durable recovery copy if a later generation is interrupted.
}
