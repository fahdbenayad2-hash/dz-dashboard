import type { TrackingOrder, DailySnapshot, OrderRiskAssessment } from '@/types';
import { assessOrderRisk } from '@/lib/aiRiskEngine';

export interface HighRiskOrder {
  order: TrackingOrder;
  assessment: OrderRiskAssessment;
}

export function getHighRiskOrders(
  tracking: TrackingOrder[],
  _allTracking: TrackingOrder[],
  _snapshots: DailySnapshot[],
  threshold: number = 60,
): HighRiskOrder[] {
  const result: HighRiskOrder[] = [];

  for (const order of tracking) {
    if (!order.wilaya || !order.total) continue;
    const assessment = assessOrderRisk(order.wilaya, order.total);
    if (assessment.score >= threshold) {
      result.push({ order, assessment });
    }
  }

  return result.sort((a, b) => b.assessment.score - a.assessment.score);
}
