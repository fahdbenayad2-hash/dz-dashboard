import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
const source = readFileSync(new URL('./ResumableSync.gs', import.meta.url), 'utf8');
function core() { return runInNewContext(source + ';({page: dzPageProgress_, map: dzMapRow_, merge: dzMergeRows_})', { }); }
describe('resumable synchronization invariants', () => {
  it('advances offset by rows and page mode by one', () => {
    const c = core(), data = { data: [{}, {}], all_count: 4 };
    expect(c.page(data, 0, 0, 2, 'offset', null).cursor).toBe(2);
    expect(c.page(data, 0, 0, 2, 'page', null).cursor).toBe(1);
    expect(c.page(data, 0, 0, 2, 'page', null).done).toBe(false);
  });
  it('rejects malformed responses and accepts an empty final page', () => {
    const c = core();
    expect(() => c.page(null, 1, 2, 2, 'page', 4)).toThrow();
    expect(c.page({ data: [], all_count: 4 }, 2, 4, 2, 'page', 4).done).toBe(true);
  });
  it('accepts source growth but rejects shrinkage', () => {
    const c = core();
    expect(c.page({ data: [{}], all_count: 5 }, 1, 2, 2, 'page', 4).expected).toBe(5);
    expect(() => c.page({ data: [{}], all_count: 3 }, 1, 2, 2, 'page', 4)).toThrow('SOURCE_SHRANK');
  });
  it('completes only at a short final page', () => {
    const c = core();
    expect(c.page({ data: [{}, {}], all_count: 4 }, 1, 2, 2, 'page', 4).done).toBe(false);
    expect(c.page({ data: [{}] }, 1, 2, 2, 'page', null).done).toBe(true);
  });
  it('preserves archives and keeps the newest copy of shifted source IDs', () => {
    const c = core();
    expect(c.merge([[2, 'fresh']], [[2, 'archive'], [1, 'old']]).map((r: unknown[]) => r[1])).toEqual(['fresh', 'old']);
    expect(c.merge([[2, 'newest'], [2, 'shifted']], [])).toEqual([[2, 'newest']]);
  });
  it('retains all product fields without assigning a basket to its first item', () => {
    const items = [{ product: { name: 'A' }, quantity: 2 }, { product: { name: 'B' }, quantity: 3 }];
    const row = core().map('Orders', { id: 1, order_total: 300, products_order: items, customer: { fullname: '=1+1' } });
    expect(row[6]).toBe('[سلة متعددة المنتجات]');
    expect(row[2]).toBe("'=1+1");
    expect(JSON.parse(row[10])).toEqual(items);
  });
  it('rejects missing IDs and nonnumeric amounts', () => {
    expect(() => core().map('Orders', { order_total: 10 })).toThrow();
    expect(() => core().map('Tracking', { order: { id: 1, order_total: 'invalid' } })).toThrow();
  });
});

function harness(timeoutDuringSetup = false) {
  let clock = Date.now(), nextId = 1;
  const properties: Record<string, string> = { DZ_PAGINATION_MODE: 'page', DZ_TARGET_PREFIX: 'production' };
  const sheets = new Map<number, FakeSheet>();
  class FakeSheet {
    id = nextId++; rows: unknown[][] = []; maxRows = 1000;
    constructor(public name: string) { sheets.set(this.id, this); }
    getSheetId() { return this.id; }
    getMaxRows() { return this.maxRows; }
    getMaxColumns() { return 26; }
    getLastRow() { return this.rows.length; }
    hideSheet() { return this; }
    insertRowsAfter(_start: number, count: number) { this.maxRows += count; }
    getRange(start: number, col: number, count: number, width: number) {
      return {
        getValues: () => Array.from({ length: count }, (_, i) => Array.from({ length: width }, (_, j) => this.rows[start - 1 + i]?.[col - 1 + j] ?? '')),
        setValues: (values: unknown[][]) => { values.forEach((row, i) => { this.rows[start - 1 + i] ||= []; row.forEach((v, j) => this.rows[start - 1 + i][col - 1 + j] = v); }); },
        clearContent: () => { for (let i = start - 1; i < start - 1 + count; i++) this.rows[i] = Array(width).fill(''); },
      };
    }
  }
  const ss = { insertSheet: (name: string) => {
    const sheet = new FakeSheet(name);
    if (timeoutDuringSetup && name.startsWith('_dz_Tracking_')) {
      timeoutDuringSetup = false;
      throw new Error('Service Spreadsheets timed out');
    }
    return sheet;
  }, getSheetById: (id: number) => sheets.get(id), getSheetByName: (name: string) => [...sheets.values()].find(s => s.name === name), getId: () => 'synthetic' };
  ss.insertSheet('Orders').rows = [['ID'], [99, 'existing']];
  ss.insertSheet('Tracking').rows = [['ID'], [99, 'existing']];
  let fail = false, slow = true, publications = 0;
  const cursors: number[] = [];
  const ctx = {
    Date: class extends Date { static now() { return clock; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => properties[key] || null, setProperty: (key: string, value: string) => { properties[key] = value; }, deleteProperty: (key: string) => { delete properties[key]; } }) },
    LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => {} },
    Utilities: { getUuid: () => 'synthetic-generation' },
    CONFIG: { ORDERS_HEADERS: Array(10).fill('h'), TRACKING_HEADERS: Array(10).fill('h'), ORDERS_LIMIT: 1, TRACKING_LIMIT: 1, ORDERS_ENDPOINT: 'orders', TRACKING_ENDPOINT: 'tracking' },
    apiGet_: (endpoint: string, params: { offset: number }) => {
      cursors.push(params.offset); if (fail) throw new Error('Network');
      if (slow) clock += 130000;
      const order = { id: params.offset + 1, order_total: 100 };
      return { all_count: 2, data: params.offset >= 2 ? [] : [endpoint === 'orders' ? order : { order }] };
    },
    Sheets: { Spreadsheets: { batchUpdate: () => { publications++; } } },
  };
  const tick = runInNewContext(source + ';dzSyncTick', ctx);
  return { tick, properties, sheets, cursors, get publications() { return publications; }, set fail(value: boolean) { fail = value; }, set slow(value: boolean) { slow = value; } };
}
it('resumes from checkpoints and keeps published data until both sources complete', () => {
  const h = harness();
  h.tick();
  expect(h.cursors).toEqual([0]);
  expect(h.publications).toBe(0);
  const state = JSON.parse(h.properties.DZ_SYNC_STATE);
  expect(state.sources.Orders.cursor).toBe(1);
  expect([...h.sheets.values()].find(s => s.name === 'Orders')!.rows[1]).toEqual([99, 'existing']);
  h.tick();
  expect(h.cursors.slice(0, 2)).toEqual([0, 1]);
  h.slow = false;
  h.tick();
  expect(h.publications).toBe(1);
  expect(h.properties.DZ_SYNC_STATE).toBeUndefined();
});
it('a failed page preserves its checkpoint and never publishes', () => {
  const h = harness(); h.tick();
  const checkpoint = h.properties.DZ_SYNC_STATE;
  h.fail = true;
  expect(() => h.tick()).toThrow('SYNC_FAILED');
  expect(h.properties.DZ_SYNC_STATE).toBe(checkpoint);
  expect(h.publications).toBe(0);
});

it('reuses a staging sheet created before an uncertain setup timeout', () => {
  const h = harness(true);
  expect(() => h.tick()).toThrow('SYNC_FAILED');
  const before = JSON.parse(h.properties.DZ_SYNC_STATE);
  expect(before.sources.Orders.cursor).toBe(0);
  expect(before.sources.Tracking).toBeUndefined();
  h.tick();
  expect(JSON.parse(h.properties.DZ_SYNC_STATE).generation).toBe(before.generation);
  expect([...h.sheets.values()].filter(s => s.name.startsWith('_dz_Tracking_'))).toHaveLength(1);
  expect(h.cursors).toEqual([0]);
  expect(h.publications).toBe(0);
});
