import type { DailySnapshot, OrderRiskAssessment, CustomerRiskAssessment, DailyRiskPrediction } from '@/types';

const WILAYA_RISK_MAP: Record<string, number> = {
  'أدرار': 45, 'الشلف': 35, 'الأغواط': 40, 'أم البواقي': 30, 'باتنة': 35,
  'بجاية': 25, 'بسكرة': 40, 'بشار': 50, 'البليدة': 20, 'البويرة': 30,
  'تمنراست': 60, 'تبسة': 40, 'تلمسان': 30, 'تيارت': 35, 'تيزي وزو': 15,
  'الجزائر': 10, 'الجلفة': 35, 'جيجل': 30, 'سطيف': 25, 'سعيدة': 40,
  'سكيكدة': 30, 'سيدي بلعباس': 35, 'عنابة': 20, 'قالمة': 35, 'قسنطينة': 20,
  'المدية': 30, 'مستغانم': 30, 'المسيلة': 35, 'معسكر': 40, 'وهران': 15,
  'البيض': 50, 'إليزي': 65, 'برج بوعريريج': 30, 'بومرداس': 25,
  'الطارف': 35, 'تندوف': 70, 'تيسمسيلت': 40, 'الوادي': 45, 'خنشلة': 35,
  'سوق أهراس': 35, 'تيبازة': 25, 'ميلة': 30, 'عين الدفلى': 30,
  'النعامة': 50, 'عين تموشنت': 35, 'غرداية': 45, 'غليزان': 35,
  'المغير': 50, 'المنيعة': 55, 'أولاد جلال': 45, 'برج باجي مختار': 70,
  'بني عباس': 65, 'تيميمون': 60, 'تقرت': 50, 'جانت': 70, 'عين صالح': 60,
  'عين قزام': 75, 'البرج': 40,
};

function getWilayaRisk(wilaya: string): number {
  return WILAYA_RISK_MAP[wilaya] ?? 50;
}

function getAmountRisk(total: number): number {
  if (total <= 5000) return 10;
  if (total <= 10000) return 25;
  if (total <= 15000) return 45;
  if (total <= 25000) return 70;
  if (total <= 40000) return 85;
  return 95;
}

function scoreToLevel(score: number): { level: 'low' | 'medium' | 'high' | 'critical'; color: string } {
  if (score >= 80) return { level: 'critical', color: '#E24B4A' };
  if (score >= 60) return { level: 'high', color: '#EF9F27' };
  if (score >= 40) return { level: 'medium', color: '#378ADD' };
  return { level: 'low', color: '#1D9E75' };
}

export function assessOrderRisk(wilaya: string, totalAmount: number): OrderRiskAssessment {
  const wilayaRisk = getWilayaRisk(wilaya);
  const amountRisk = getAmountRisk(totalAmount);

  const score = Math.round(wilayaRisk * 0.3 + amountRisk);
  const { level, color } = scoreToLevel(score);

  const factors: OrderRiskAssessment['factors'] = [
    {
      label: 'مخاطر الولاية',
      impact: wilayaRisk,
      detail: `الولاية: ${wilaya} — مستوى الخطر ${wilayaRisk >= 50 ? 'مرتفع' : wilayaRisk >= 30 ? 'متوسط' : 'منخفض'}`,
    },
    {
      label: 'مخاطر قيمة الطلب',
      impact: amountRisk,
      detail: `قيمة الطلب: ${totalAmount.toLocaleString('ar-DZ')} دج — ${amountRisk >= 60 ? 'مرتفع' : amountRisk >= 30 ? 'متوسط' : 'منخفض'}`,
    },
  ];

  return { score, level, color, factors, wilayaRisk, amountRisk };
}

export function assessCustomerRisk(totalOrders: number, returnedOrders: number): CustomerRiskAssessment {
  const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;

  let score = 0;

  if (totalOrders >= 10) {
    if (returnRate > 50) score = 50;
    else if (returnRate > 30) score = 30;
    else if (returnRate > 20) score = 15;
    else score = 5;
  } else if (totalOrders >= 5) {
    if (returnRate > 40) score = 12;
    else if (returnRate > 20) score = 8;
    else score = 4;
  } else {
    score = Math.min(25, returnedOrders * 4 + (totalOrders === 0 ? 10 : 0));
  }

  const { level, color } = scoreToLevel(score);

  return { score, level, color, totalOrders, returnedOrders, returnRate };
}

export function predictDailyRisk(snapshots: DailySnapshot[]): DailyRiskPrediction | null {
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const days = sorted.length;

  const avgOrders = sorted.reduce((s, d) => s + d.totalOrders, 0) / days;
  const avgDelivered = sorted.reduce((s, d) => s + d.delivered, 0) / days;
  const avgReturned = sorted.reduce((s, d) => s + d.returned, 0) / days;
  const avgRevenue = sorted.reduce((s, d) => s + d.totalRevenue, 0) / days;

  let confidence: DailyRiskPrediction['confidence'];
  let confidenceScore: number;

  if (days >= 30) { confidence = 'high'; confidenceScore = 90; }
  else if (days >= 14) { confidence = 'medium'; confidenceScore = 65; }
  else if (days >= 7) { confidence = 'medium'; confidenceScore = 45; }
  else { confidence = 'low'; confidenceScore = 25; }

  return {
    predictedOrders: Math.round(avgOrders),
    predictedDelivered: Math.round(avgDelivered),
    predictedReturned: Math.round(avgReturned),
    predictedRevenue: Math.round(avgRevenue),
    confidence,
    confidenceScore,
    basedOnDays: days,
  };
}

export { WILAYA_RISK_MAP };
