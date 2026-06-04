import type { PricingInputs, PricingResult, RiskFactor, RiskDetail } from '@/types';
import { calculatePricing } from './financialEngine';

export function getRiskDetail(inputs: PricingInputs, result: PricingResult): RiskDetail {
  const factors: RiskFactor[] = [];

  const cancelPenalty = inputs.cancellationRate > 50 ? 35 : inputs.cancellationRate > 40 ? 20 : inputs.cancellationRate > 30 ? 10 : 0;
  factors.push({
    label: 'معدل الإلغاء',
    currentValue: inputs.cancellationRate.toFixed(1) + '%',
    benchmark: 'أقل من 30%',
    penalty: cancelPenalty,
    recommendation: inputs.cancellationRate > 40
      ? 'خفض معدل الإلغاء بتحسين استهداف العملاء'
      : 'مقبول، يمكن تحسينه',
  });

  const marginPenalty = result.netMargin < 20 ? 30 : result.netMargin < 30 ? 15 : result.netMargin < 40 ? 5 : 0;
  factors.push({
    label: 'هامش الربح الصافي',
    currentValue: result.netMargin.toFixed(1) + '%',
    benchmark: 'أكثر من 40%',
    penalty: marginPenalty,
    recommendation: result.netMargin < 20
      ? 'زيادة السعر أو خفض التكاليف'
      : 'يمكن تحسين الهامش',
  });

  const cpaRatio = inputs.adCostPerOrder / result.recommendedPrice;
  const cpaPenalty = cpaRatio > 0.35 ? 25 : cpaRatio > 0.25 ? 15 : cpaRatio > 0.15 ? 5 : 0;
  factors.push({
    label: 'نسبة تكلفة الإعلان',
    currentValue: (cpaRatio * 100).toFixed(1) + '%',
    benchmark: 'أقل من 15%',
    penalty: cpaPenalty,
    recommendation: cpaRatio > 0.25
      ? 'خفض تكلفة الإعلان أو استهداف أكثر دقة'
      : 'مقبول',
  });

  const shipRatio = inputs.shippingFee / result.recommendedPrice;
  const shipPenalty = shipRatio > 0.25 ? 10 : shipRatio > 0.15 ? 5 : 0;
  factors.push({
    label: 'نسبة رسوم الشحن',
    currentValue: (shipRatio * 100).toFixed(1) + '%',
    benchmark: 'أقل من 15%',
    penalty: shipPenalty,
    recommendation: shipRatio > 0.2
      ? 'تفاوض على أسعار شحن أفضل'
      : 'مقبول',
  });

  const codBuffer = (result.cod / result.recommendedPrice) * 100;
  const codPenalty = codBuffer > 10 ? 10 : codBuffer > 5 ? 5 : 0;
  factors.push({
    label: 'رسوم COD',
    currentValue: codBuffer.toFixed(1) + '%',
    benchmark: 'أقل من 5%',
    penalty: codPenalty,
    recommendation: codBuffer > 8
      ? 'خفض نسبة COD أو التفاوض مع شركة الشحن'
      : 'مقبول',
  });

  const actionPlan: string[] = [];
  if (inputs.cancellationRate > 35) {
    actionPlan.push('تحسين جودة العملاء المتوقعين لتقليل معدل الإلغاء');
  }
  if (result.netMargin < 25) {
    actionPlan.push('رفع السعر أو تقليل التكاليف لتحسين هامش الربح');
  }
  if (cpaRatio > 0.25) {
    actionPlan.push('تحسين الحملات الإعلانية لتقليل تكلفة الاكتساب');
  }
  if (shipRatio > 0.2) {
    actionPlan.push('التفاوض على رسوم شحن أقل مع مقدمي الخدمات');
  }
  if (result.cod / result.recommendedPrice > 0.08) {
    actionPlan.push('خفض رسوم COD أو تحسين معدل القبول عند الدفع');
  }
  if (actionPlan.length === 0) {
    actionPlan.push('الأداء جيد، استمر في المراقبة');
  }

  return {
    score: result.riskScore,
    level: result.riskLevel,
    color: result.riskColor,
    factors,
    actionPlan,
  };
}

export function calculatePortfolioRisk(products: { name: string; inputs: PricingInputs }[]): {
  overallScore: number;
  distribution: { low: number; medium: number; high: number };
  urgentFixes: { product: string; action: string }[];
} {
  let totalScore = 0;
  let low = 0, medium = 0, high = 0;
  const urgentFixes: { product: string; action: string }[] = [];

  for (const p of products) {
    const result = calculatePricing(p.inputs);
    totalScore += result.riskScore;
    if (result.riskScore >= 80) low++;
    else if (result.riskScore >= 50) medium++;
    else high++;

    if (result.riskScore < 50) {
      if (p.inputs.cancellationRate > 40) {
        urgentFixes.push({ product: p.name, action: 'خفض معدل الإلغاء' });
      }
      if (result.netMargin < 20) {
        urgentFixes.push({ product: p.name, action: 'تحسين هامش الربح' });
      }
    }
  }

  const count = products.length || 1;
  return {
    overallScore: Math.round(totalScore / count),
    distribution: { low, medium, high },
    urgentFixes: urgentFixes.slice(0, 3),
  };
}
