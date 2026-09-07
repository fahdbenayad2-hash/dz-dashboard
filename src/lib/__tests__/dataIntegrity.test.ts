import { describe, it, expect, vi, afterEach } from 'vitest';
import { classifyTrackingStatus, normalizeStatus } from '../status';
import { getYearlyTopProducts, getYearComparison } from '../dashboardMetrics';
import { analyzeProductPeriod, buildFinancialAnalysis } from '../financialEngine';
import { fetchOrders } from '../sheetsApi';
import type { TrackingOrder } from '@/types';

const order = (statusCategory: TrackingOrder['statusCategory'], date = '2026-06-10T12:00:00Z'): TrackingOrder => ({
  orderId: 'example', date: new Date(date), customer: 'test', agent: 'test', wilaya: 'test',
  product: 'test', total: 5000, delivery: 500, trackingStatus: '', driver: '', statusCategory,
});

afterEach(() => vi.unstubAllGlobals());
describe('data integrity regressions', () => {
  it.each(['non livré', 'not delivered', 'en attente de livraison', 'unknown'])('does not classify %s as delivered', value => {
    expect(classifyTrackingStatus(value)).toBe('others');
  });
  it('recognizes exact carrier statuses and normalized confirmation', () => {
    expect(classifyTrackingStatus(' Livré ')).toBe('delivered');
    expect(classifyTrackingStatus('En cours de livraison')).toBe('delivery');
    expect(classifyTrackingStatus('Colis Ramassé')).toBe('transit');
    expect(normalizeStatus('Confirmed')).toBe('Confirmed');
    expect(normalizeStatus('مؤكدة')).toBe('Confirmed');
  });
  it('never counts an unsettled product as delivered', () => {
    expect(getYearlyTopProducts([order('transit')], 2026)[0].deliveryRate).toBe(0);
    expect(getYearlyTopProducts([order('transit'), order('delivered'), order('returned')], 2026)[0].deliveryRate).toBe(50);
  });
  it('weights annual delivery rate by settled orders rather than months', () => {
    const data = [order('delivered', '2026-01-10T12:00:00Z'), ...Array.from({ length: 9 }, () => order('returned'))];
    expect(getYearComparison(data, 2026).current.avgDeliveryRate).toBe(10);
  });
  it('deducts return shipping consistently from both profit figures', () => {
    const period = analyzeProductPeriod([order('delivered'), order('returned')], { productName: 'test', dateFrom: '2026-06-01', dateTo: '2026-06-30' });
    const result = buildFinancialAnalysis(period, { unitCost: 1000, unitPrice: 5000, shippingFeePerOrder: 0, returnFeePerOrder: 0, packagingCostPerOrder: 0, adSpend: 0, otherExpenses: 0, expenseNotes: '' });
    expect(result.trueNetProfit).toBe(2000);
    expect(result.trueNetProfit).toBe(result.netProfit);
  });
  it('rejects HTTP failures and malformed data instead of treating them as empty sheets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(fetchOrders()).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ table: {} }) }));
    await expect(fetchOrders()).rejects.toThrow();
  });
});
