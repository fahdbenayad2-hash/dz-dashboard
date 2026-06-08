import type { PricingInputs, PricingResult, CostBreakdown, TrackingOrder, ProductExpenses, ProductPeriodFilter, ProductPeriodData, ProductFinancialAnalysis, WilayaAnalysis, CompetitorData, CompetitiveAnalysis } from '@/types';
import { getDateISOString, isValidDate } from '@/lib/dashboardMetrics';

export function calculateProductCost(inputs: PricingInputs): number {
  return inputs.fabricPricePerMeter * inputs.fabricMeters + inputs.sewingCost + inputs.accessoriesCost;
}

export function calculateLogisticsCost(inputs: PricingInputs): number {
  return inputs.storageCost + inputs.packagingCost + inputs.shippingFee;
}

export function calculateReturnLoss(inputs: PricingInputs): number {
  return inputs.returnCost * (inputs.cancellationRate / 100);
}

export function calculateBaseCost(inputs: PricingInputs): number {
  return calculateProductCost(inputs) + calculateLogisticsCost(inputs) + inputs.adCostPerOrder + calculateReturnLoss(inputs);
}

export function calculateCODRate(inputs: PricingInputs): number {
  return inputs.codType === 'percentage' ? inputs.codValue / 100 : 0;
}

export function calculateRawPrice(baseCost: number, targetProfit: number, codRate: number, codType: PricingInputs['codType'], codValue: number): number {
  if (codType === 'percentage' && codRate > 0) {
    return (baseCost + targetProfit) / (1 - codRate);
  }
  return baseCost + targetProfit + codValue;
}

export function calculateCOD(price: number, inputs: PricingInputs): number {
  if (inputs.codType === 'percentage') {
    return price * (inputs.codValue / 100);
  }
  return inputs.codValue;
}

export function toX990Price(price: number): number {
  return Math.ceil(price / 1000) * 1000 - 10;
}

function toX990PriceAtOrAbove(price: number, minPrice: number): number {
  const x990 = toX990Price(price);
  return x990 >= minPrice ? x990 : toX990Price(minPrice + 1);
}

export function calculateRecommendedPrice(baseCost: number, targetProfit: number, inputs: PricingInputs): number {
  const codRate = calculateCODRate(inputs);
  const rawPrice = calculateRawPrice(baseCost, targetProfit, codRate, inputs.codType, inputs.codValue);
  const x990 = toX990Price(rawPrice);
  const codAtX990 = calculateCOD(x990, inputs);
  const netAtX990 = x990 - baseCost - codAtX990;
  if (netAtX990 >= targetProfit) return x990;
  return toX990PriceAtOrAbove(rawPrice, x990 + 1000);
}

export function calculateProfit(price: number, baseCost: number, cod: number): number {
  return price - baseCost - cod;
}

export function calculateMargin(profit: number, price: number): number {
  return price > 0 ? (profit / price) * 100 : 0;
}

export function calculatePricing(inputs: PricingInputs): PricingResult {
  const productCost = calculateProductCost(inputs);
  const logisticsCost = calculateLogisticsCost(inputs);
  const returnLoss = calculateReturnLoss(inputs);
  const baseCost = calculateBaseCost(inputs);

  const minPrice = calculateRawPrice(baseCost, 0, calculateCODRate(inputs), inputs.codType, inputs.codValue);
  const recommendedPrice = calculateRecommendedPrice(baseCost, inputs.desiredProfit, inputs);
  const aggressivePrice = calculateRecommendedPrice(baseCost, inputs.desiredProfit * 0.7, inputs);
  const premiumPrice = calculateRecommendedPrice(baseCost, inputs.desiredProfit * 1.5, inputs);

  const cod = calculateCOD(recommendedPrice, inputs);
  const netProfit = calculateProfit(recommendedPrice, baseCost, cod);
  const netMargin = calculateMargin(netProfit, recommendedPrice);
  const grossProfit = recommendedPrice - productCost;
  const grossMargin = calculateMargin(grossProfit, recommendedPrice);
  const breakEven = baseCost + cod;

  const totalBreakdown = productCost + logisticsCost + inputs.adCostPerOrder + returnLoss + cod + netProfit;

  const costBreakdown: CostBreakdown = {
    product: { value: productCost, percentage: totalBreakdown > 0 ? (productCost / totalBreakdown) * 100 : 0 },
    logistics: { value: logisticsCost, percentage: totalBreakdown > 0 ? (logisticsCost / totalBreakdown) * 100 : 0 },
    ads: { value: inputs.adCostPerOrder, percentage: totalBreakdown > 0 ? (inputs.adCostPerOrder / totalBreakdown) * 100 : 0 },
    returns: { value: returnLoss, percentage: totalBreakdown > 0 ? (returnLoss / totalBreakdown) * 100 : 0 },
    cod: { value: cod, percentage: totalBreakdown > 0 ? (cod / totalBreakdown) * 100 : 0 },
    profit: { value: netProfit, percentage: totalBreakdown > 0 ? (netProfit / totalBreakdown) * 100 : 0 },
  };

  const riskScore = calculateRiskScore(inputs.cancellationRate, netMargin, inputs.adCostPerOrder, recommendedPrice, inputs.shippingFee);
  const riskLevel = riskScore >= 80 ? 'منخفض' : riskScore >= 50 ? 'متوسط' : 'مرتفع';
  const riskColor = riskScore >= 80 ? '#1D9E75' : riskScore >= 50 ? '#EF9F27' : '#E24B4A';

  return {
    productCost, fulfillmentCost: logisticsCost, returnLoss, baseCost,
    cod, minPrice, recommendedPrice, aggressivePrice, premiumPrice,
    netProfit, netMargin, breakEven, grossProfit, grossMargin,
    costBreakdown, riskScore, riskLevel, riskColor,
  };
}

function calculateRiskScore(
  cancellationRate: number,
  netMargin: number,
  adCostPerOrder: number,
  recommendedPrice: number,
  shippingFee: number,
): number {
  let score = 100;

  if (cancellationRate > 50) score -= 35;
  else if (cancellationRate > 40) score -= 20;
  else if (cancellationRate > 30) score -= 10;

  if (netMargin < 20) score -= 30;
  else if (netMargin < 30) score -= 15;
  else if (netMargin < 40) score -= 5;

  const cpaRatio = adCostPerOrder / recommendedPrice;
  if (cpaRatio > 0.35) score -= 25;
  else if (cpaRatio > 0.25) score -= 15;
  else if (cpaRatio > 0.15) score -= 5;

  const shippingRatio = shippingFee / recommendedPrice;
  if (shippingRatio > 0.25) score -= 10;
  else if (shippingRatio > 0.15) score -= 5;

  return Math.max(0, score);
}

// ── تحليل المنتج المتقدم ──

export function analyzeProductPeriod(
  tracking: TrackingOrder[],
  filter: ProductPeriodFilter,
): ProductPeriodData {
  const from = new Date(filter.dateFrom);
  const to = new Date(filter.dateTo);
  to.setHours(23, 59, 59, 999);

  const periodOrders = tracking.filter(t => {
    if (t.product !== filter.productName) return false;
    if (!isValidDate(t.date)) return false;
    return t.date >= from && t.date <= to;
  });

  const delivered = periodOrders.filter(t => t.statusCategory === 'delivered');
  const returned  = periodOrders.filter(t => t.statusCategory === 'returned');
  const inProg    = periodOrders.filter(t => t.statusCategory === 'transit' || t.statusCategory === 'delivery');
  const others    = periodOrders.filter(t => t.statusCategory === 'others');

  const settledCount     = delivered.length + returned.length;
  const cancellationRate = settledCount > 0 ? (returned.length / settledCount) * 100 : 0;
  const deliveryRate     = settledCount > 0 ? (delivered.length / settledCount) * 100 : 0;

  const grossRevenue          = delivered.reduce((s, t) => s + t.total, 0);
  const deliveryCostPaid      = delivered.reduce((s, t) => s + t.delivery, 0);
  const netRevenue            = grossRevenue - deliveryCostPaid;
  const returnShippingLoss    = returned.reduce((s, t) => s + t.delivery, 0);
  const returnedProductValue  = returned.reduce((s, t) => s + t.total, 0);

  const avgOrderValue   = delivered.length > 0 ? grossRevenue / delivered.length : 0;
  const avgDeliveryCost = delivered.length > 0 ? deliveryCostPaid / delivered.length : 0;

  const msPerDay = 86400000;
  const daysInPeriod = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / msPerDay));
  const dailyMap = new Map<string, { orders: number; delivered: number; revenue: number }>();
  periodOrders.forEach(t => {
    if (!isValidDate(t.date)) return;
    const key = getDateISOString(t.date);
    const e = dailyMap.get(key) || { orders: 0, delivered: 0, revenue: 0 };
    e.orders++;
    if (t.statusCategory === 'delivered') { e.delivered++; e.revenue += t.total; }
    dailyMap.set(key, e);
  });
  const dailyTrend = [...dailyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => ({ date, ...d }));

  const wilayaMap = new Map<string, { orders: number; delivered: number }>();
  periodOrders.forEach(t => {
    if (!t.wilaya) return;
    const e = wilayaMap.get(t.wilaya) || { orders: 0, delivered: 0 };
    e.orders++;
    if (t.statusCategory === 'delivered') e.delivered++;
    wilayaMap.set(t.wilaya, e);
  });
  const topWilayas = [...wilayaMap.entries()]
    .map(([wilaya, d]) => ({
      wilaya, ...d,
      deliveryRate: d.orders > 0 ? (d.delivered / d.orders) * 100 : 0,
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  return {
    totalOrders: periodOrders.length,
    delivered: delivered.length,
    returned: returned.length,
    inProgress: inProg.length,
    others: others.length,
    settledCount, cancellationRate, deliveryRate,
    grossRevenue, deliveryCostPaid, netRevenue,
    returnShippingLoss, returnedProductValue,
    avgOrderValue, avgDeliveryCost,
    daysInPeriod, avgDailyOrders: periodOrders.length / daysInPeriod,
    dailyTrend, topWilayas,
  };
}

export function buildFinancialAnalysis(
  period: ProductPeriodData,
  expenses: ProductExpenses,
): ProductFinancialAnalysis {
  const totalAdAndOther = expenses.adSpend + expenses.otherExpenses;

  const variableCostPerOrder = expenses.unitCost + expenses.shippingFeePerOrder + expenses.packagingCostPerOrder;
  const totalCOGS = period.delivered * expenses.unitCost;
  const totalShippingPaid = period.delivered * expenses.shippingFeePerOrder;
  const totalPackaging = period.totalOrders * expenses.packagingCostPerOrder;
  const returnTotalCost = period.returned * (expenses.returnFeePerOrder + expenses.unitCost);

  const totalCost = period.deliveryCostPaid + period.returnShippingLoss
    + totalCOGS + totalShippingPaid + totalPackaging + returnTotalCost
    + totalAdAndOther;

  const trueNetProfit = period.netRevenue - totalCOGS - totalShippingPaid - totalPackaging
    - returnTotalCost - expenses.adSpend - expenses.otherExpenses;
  const trueNetMargin = period.grossRevenue > 0 ? (trueNetProfit / period.grossRevenue) * 100 : 0;
  const profitPerUnit = period.avgOrderValue > 0
    ? period.avgOrderValue - variableCostPerOrder - period.avgDeliveryCost : 0;
  const breakEvenUnits = profitPerUnit > 0
    ? Math.ceil(totalAdAndOther / profitPerUnit) : 0;

  const roas = expenses.adSpend > 0 ? period.grossRevenue / expenses.adSpend : 0;
  const cpa = period.delivered > 0 && expenses.adSpend > 0 ? expenses.adSpend / period.delivered : 0;

  const totalInvestment = totalCOGS + expenses.adSpend + expenses.otherExpenses;
  const roi = totalInvestment > 0 ? (trueNetProfit / totalInvestment) * 100 : 0;

  const grossProfit = period.grossRevenue - period.deliveryCostPaid - period.returnShippingLoss;
  const netProfit = period.grossRevenue - totalCost;
  const netMargin = period.grossRevenue > 0 ? (netProfit / period.grossRevenue) * 100 : 0;
  const avgNetPerDelivered = period.avgOrderValue - period.avgDeliveryCost;
  const breakEvenOrders = avgNetPerDelivered > 0 ? Math.ceil(totalCost / avgNetPerDelivered) : 0;

  let decision: ProductFinancialAnalysis['decision'];
  const reasons: string[] = [];
  const actions: string[] = [];

  if (trueNetMargin >= 20 && period.deliveryRate >= 65 && profitPerUnit > 0) {
    decision = 'scale';
  } else if (trueNetMargin >= 8 && period.deliveryRate >= 50) {
    decision = 'optimize';
  } else if (trueNetMargin >= 0 && period.settledCount >= 10) {
    decision = 'monitor';
  } else {
    decision = 'stop';
  }

  if (period.deliveryRate < 50)
    reasons.push(`معدل التوصيل ضعيف ${period.deliveryRate.toFixed(1)}%`);
  if (period.deliveryRate >= 65)
    reasons.push(`معدل توصيل جيد ${period.deliveryRate.toFixed(1)}%`);
  if (trueNetMargin < 0)
    reasons.push(`المنتج يخسر — صافي الهامش ${trueNetMargin.toFixed(1)}%`);
  if (trueNetMargin >= 20)
    reasons.push(`هامش ربح صحي ${trueNetMargin.toFixed(1)}%`);
  if (profitPerUnit <= 0)
    reasons.push(`ربح القطعة سالب — تكلفة المتغيرات أعلى من سعر البيع`);
  if (roas > 0 && roas < 2)
    reasons.push(`ROAS ضعيف ${roas.toFixed(2)}x`);
  if (roas >= 3)
    reasons.push(`ROAS ممتاز ${roas.toFixed(2)}x`);
  if (period.cancellationRate > 40)
    reasons.push(`معدل الإرجاع مرتفع ${period.cancellationRate.toFixed(1)}%`);
  if (period.settledCount < 10)
    reasons.push(`عينة صغيرة — ${period.settledCount} طلب محسوم`);
  if (cpa > 0)
    reasons.push(`CPA = ${cpa.toLocaleString('ar-DZ')} دج`);

  if (decision === 'scale') {
    actions.push('زد الميزانية الإعلانية بـ 20-30% تدريجياً مع مراقبة ROAS');
    actions.push('وسّع لولايات جديدة — ابدأ بأقرب الولايات جغرافياً للأفضل أداءً');
    actions.push('اختبر creatives إعلانية جديدة للحفاظ على ROAS');
    actions.push('جهّز مخزوناً كافياً لاستيعاب الطلبات المتزايدة');
  } else if (decision === 'optimize') {
    if (period.cancellationRate > 30)
      actions.push('راجع نص الإعلان والصورة — قد تستقطب جمهوراً غير مستهدف');
    if (roas > 0 && roas < 3)
      actions.push('اختبر تخفيض الميزانية وتركيزها على أفضل الإعلانات أداءً');
    actions.push('ركّز الإعلانات على الولايات التي تُظهر أعلى معدل توصيل');
    actions.push('اختبر سعراً أعلى بـ 5-10% — قد يرفع الهامش');
    if (period.avgDeliveryCost > 450)
      actions.push('فاوض شركة الشحن على سعر أفضل — التكلفة مرتفعة');
  } else if (decision === 'monitor') {
    actions.push('أكمل الفترة الحالية حتى تصل لـ 30+ طلب محسوم للحكم الدقيق');
    actions.push('وثّق كل تغيير في الإعلانات مع تاريخه');
    actions.push('قارن أداء الولايات وركّز على الأفضل');
  } else {
    actions.push('أوقف الإنفاق الإعلاني فوراً لوقف النزيف المالي');
    actions.push('راجع جودة المنتج إذا كان معدل الإرجاع مرتفعاً');
    actions.push('ادرس إعادة التسعير جذرياً أو تغيير قناة التسويق');
    actions.push('قيّم تصفية المخزون الحالي بسعر التكلفة');
  }

  const decisionConfig = {
    scale:    { label: 'قابل للتوسعة 🚀',    color: '#1D9E75' },
    optimize: { label: 'يحتاج تحسين ⚙️',    color: '#EF9F27' },
    monitor:  { label: 'راقب ولا تتسرع 👁',  color: '#378ADD' },
    stop:     { label: 'أوقف الإنفاق 🛑',    color: '#E24B4A' },
  };

  return {
    period,
    expenses,
    totalInvestment,
    totalCost,
    grossProfit,
    netProfit,
    netMargin,
    roas,
    cpa,
    breakEvenOrders,
    totalCOGS,
    totalShippingPaid,
    totalPackaging,
    returnTotalCost,
    variableCostPerOrder,
    profitPerUnit,
    trueNetProfit,
    trueNetMargin,
    breakEvenUnits,
    roi,
    decision,
    decisionLabel: decisionConfig[decision].label,
    decisionColor: decisionConfig[decision].color,
    decisionReasons: reasons,
    actionPlan: actions,
  };
}

export function buildWilayaAnalysis(
  tracking: TrackingOrder[],
  filter: ProductPeriodFilter,
  expenses: ProductExpenses,
): WilayaAnalysis[] {
  const from = new Date(filter.dateFrom);
  const to = new Date(filter.dateTo);
  to.setHours(23, 59, 59, 999);

  const periodOrders = tracking.filter(t => {
    if (t.product !== filter.productName) return false;
    if (!isValidDate(t.date)) return false;
    return t.date >= from && t.date <= to;
  });

  const wilayaMap = new Map<string, { orders: number; delivered: number; returned: number; revenue: number; netRevenue: number }>();
  periodOrders.forEach(t => {
    if (!t.wilaya) return;
    const e = wilayaMap.get(t.wilaya) || { orders: 0, delivered: 0, returned: 0, revenue: 0, netRevenue: 0 };
    e.orders++;
    if (t.statusCategory === 'delivered') { e.delivered++; e.revenue += t.total; e.netRevenue += t.total - t.delivery; }
    if (t.statusCategory === 'returned') e.returned++;
    wilayaMap.set(t.wilaya, e);
  });

  const variableCostPerOrder = expenses.unitCost + expenses.shippingFeePerOrder + expenses.packagingCostPerOrder;
  const totalProfitContribution = [...wilayaMap.values()].reduce((s, d) => {
    const returnCost = d.returned * (expenses.returnFeePerOrder + expenses.unitCost);
    const contribution = d.netRevenue - (d.delivered * variableCostPerOrder) - returnCost;
    return s + Math.max(0, contribution);
  }, 0) || 1;
  const totalOrders = [...wilayaMap.values()].reduce((s, d) => s + d.orders, 0) || 1;

  return [...wilayaMap.entries()]
    .map(([wilaya, d]) => {
      const inProgress = d.orders - d.delivered - d.returned;
      const deliveryRate = d.orders > 0 ? (d.delivered / d.orders) * 100 : 0;
      const avgOrderValue = d.delivered > 0 ? d.revenue / d.delivered : 0;
      const returnCost = d.returned * (expenses.returnFeePerOrder + expenses.unitCost);
      const profitContribution = d.netRevenue - (d.delivered * variableCostPerOrder) - returnCost;
      const profitShare = Math.max(0, profitContribution) / totalProfitContribution;
      const ordersShare = d.orders / totalOrders;
      const score = Math.min(100, (deliveryRate * 0.40 + profitShare * 0.35 + ordersShare * 0.25) * 100);
      const tier: WilayaAnalysis['tier'] = score >= 70 ? 'A' : score >= 45 ? 'B' : score >= 25 ? 'C' : 'D';
      return { wilaya, orders: d.orders, delivered: d.delivered, returned: d.returned, inProgress, deliveryRate, revenue: d.revenue, netRevenue: d.netRevenue, profitContribution, avgOrderValue, returnCost, score, tier };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildCompetitiveAnalysis(
  financial: ProductFinancialAnalysis,
  competitor: CompetitorData,
): CompetitiveAnalysis {
  const priceGap = competitor.competitorPrice > 0
    ? ((financial.period.avgOrderValue - competitor.competitorPrice) / competitor.competitorPrice) * 100 : 0;
  const deliveryAdvantage = financial.period.deliveryRate - competitor.marketAvgDeliveryRate;
  const cpaEfficiency = competitor.marketAvgCPA > 0
    ? ((competitor.marketAvgCPA - financial.cpa) / competitor.marketAvgCPA) * 100 : 0;

  const competitiveScore = (deliveryAdvantage >= 0 ? 33 : 0)
    + (cpaEfficiency > 0 ? 33 : 0)
    + (financial.trueNetMargin >= 15 ? 34 : financial.trueNetMargin >= 8 ? 17 : 0);

  let position: CompetitiveAnalysis['position'];
  let positionLabel: string;
  let positionColor: string;

  if (competitiveScore >= 80) {
    position = 'leader'; positionLabel = 'رائد السوق 🏆'; positionColor = 'var(--color-success)';
  } else if (competitiveScore >= 50) {
    position = 'strong'; positionLabel = 'منافس قوي 🔵'; positionColor = 'var(--color-primary)';
  } else if (competitiveScore >= 30) {
    position = 'average'; positionLabel = 'في المنتصف ⚪'; positionColor = 'var(--color-warning)';
  } else {
    position = 'danger'; positionLabel = 'في خطر تنافسي 🔴'; positionColor = 'var(--color-danger)';
  }

  const advantages: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (deliveryAdvantage > 0) advantages.push(`معدل توصيل أعلى من السوق (+${deliveryAdvantage.toFixed(1)}%)`);
  else if (deliveryAdvantage < -5) weaknesses.push(`معدل توصيل أسوأ من السوق (${deliveryAdvantage.toFixed(1)}%)`);

  if (cpaEfficiency > 0) advantages.push(`CPA أفضل من السوق بـ ${Math.abs(cpaEfficiency).toFixed(0)}%`);
  else if (cpaEfficiency < -20) weaknesses.push(`إعلانات أغلى من السوق بـ ${Math.abs(cpaEfficiency).toFixed(0)}%`);

  if (priceGap > 10) weaknesses.push(`سعرك أعلى من المنافس بـ ${priceGap.toFixed(0)}%`);
  else if (priceGap < -5) advantages.push(`سعرك أقل من المنافس (أكثر تنافسية)`);

  if (competitiveScore >= 66 && financial.trueNetMargin >= 15)
    recommendations.push('وضعك قوي — وقت التوسع والسكالينغ');
  if (priceGap > 10)
    recommendations.push('سعرك مرتفع — جرب تخفيض 50-100 دج أو زد القيمة المقدمة');
  if (deliveryAdvantage < -5)
    recommendations.push('معدل توصيلك أسوأ من السوق — راجع شركة التوصيل');
  if (cpaEfficiency < -20)
    recommendations.push('إعلاناتك مكلفة — راجع الاستهداف والجمهور');
  if (recommendations.length === 0)
    recommendations.push('أداء متوازن — حافظ على الاستراتيجية الحالية وراقب السوق');

  return { priceGap, deliveryAdvantage, cpaEfficiency, competitiveScore, position, positionLabel, positionColor, advantages, weaknesses, recommendations };
}
