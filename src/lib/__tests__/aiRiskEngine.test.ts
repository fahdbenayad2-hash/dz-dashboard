import { describe, it, expect } from 'vitest';
import { assessOrderRisk, assessCustomerRisk, predictDailyRisk } from '../aiRiskEngine';
import type { DailySnapshot } from '@/types';

describe('aiRiskEngine', () => {
  it('طلب من تيزي وزو بقيمة 20,000 دج → يجب أن يكون score > 70', () => {
    const result = assessOrderRisk('تيزي وزو', 20000);
    expect(result.score).toBeGreaterThan(70);
    expect(result.level).toBe('high');
    expect(result.factors.length).toBe(2);
  });

  it('زبون له 3 إرجاعات من 5 طلبات → customerRisk = 12 نقطة', () => {
    const result = assessCustomerRisk(5, 3);
    expect(result.score).toBe(12);
    expect(result.returnRate).toBe(60);
    expect(result.totalOrders).toBe(5);
    expect(result.returnedOrders).toBe(3);
  });

  it('snapshots فارغة → predictDailyRisk يعود null', () => {
    const result = predictDailyRisk([]);
    expect(result).toBeNull();
  });

  it('snapshots أقل من 7 أيام → confidence = low', () => {
    const snapshots: DailySnapshot[] = [
      { date: '2026-06-01', totalOrders: 10, delivered: 7, returned: 3, totalRevenue: 50000 },
      { date: '2026-06-02', totalOrders: 12, delivered: 9, returned: 3, totalRevenue: 60000 },
      { date: '2026-06-03', totalOrders: 8, delivered: 6, returned: 2, totalRevenue: 40000 },
    ];
    const result = predictDailyRisk(snapshots);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('low');
    expect(result!.basedOnDays).toBe(3);
  });
});
