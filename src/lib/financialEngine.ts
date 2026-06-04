import type { PricingInputs, PricingResult, CostBreakdown } from '@/types';

export function calculatePricing(inputs: PricingInputs): PricingResult {
  const {
    fabricPricePerMeter, fabricMeters, sewingCost, accessoriesCost,
    storageCost, packagingCost, shippingFee, returnCost,
    codType, codValue, adCostPerOrder, cancellationRate, desiredProfit,
  } = inputs;

  const productCost = fabricPricePerMeter * fabricMeters + sewingCost + accessoriesCost;
  const fulfillmentCost = storageCost + packagingCost + shippingFee;
  const returnLoss = returnCost * (cancellationRate / 100);
  const baseCost = productCost + fulfillmentCost + adCostPerOrder + returnLoss;

  let cod = 0;
  for (let i = 0; i < 4; i++) {
    const price = baseCost + cod + desiredProfit;
    cod = codType === 'percentage' ? price * (codValue / 100) : codValue;
  }

  const minPrice = baseCost + cod + desiredProfit;

  const base = Math.ceil(minPrice / 1000) * 1000;
  const recommendedPrice = base - 10;

  const aggressivePrice = Math.ceil((baseCost + cod + desiredProfit * 0.7) / 1000) * 1000 - 10;
  const premiumPrice = Math.ceil((baseCost + cod + desiredProfit * 1.5) / 1000) * 1000 - 10;

  const netProfit = recommendedPrice - baseCost - cod;
  const netMargin = (netProfit / recommendedPrice) * 100;
  const breakEven = baseCost + cod;
  const grossMargin = ((recommendedPrice - productCost) / recommendedPrice) * 100;

  const totalBreakdown = productCost + fulfillmentCost + adCostPerOrder + returnCost * (cancellationRate / 100) + cod + netProfit;

  const costBreakdown: CostBreakdown = {
    product: { value: productCost, percentage: (productCost / totalBreakdown) * 100 },
    logistics: { value: fulfillmentCost, percentage: (fulfillmentCost / totalBreakdown) * 100 },
    ads: { value: adCostPerOrder, percentage: (adCostPerOrder / totalBreakdown) * 100 },
    returns: { value: returnLoss, percentage: (returnLoss / totalBreakdown) * 100 },
    cod: { value: cod, percentage: (cod / totalBreakdown) * 100 },
    profit: { value: netProfit, percentage: (netProfit / totalBreakdown) * 100 },
  };

  const riskScore = calculateRiskScore(cancellationRate, netMargin, adCostPerOrder, recommendedPrice, shippingFee);
  const riskLevel = riskScore >= 80 ? 'منخفض' : riskScore >= 50 ? 'متوسط' : 'مرتفع';
  const riskColor = riskScore >= 80 ? '#1D9E75' : riskScore >= 50 ? '#EF9F27' : '#E24B4A';

  return {
    productCost, fulfillmentCost, returnLoss, baseCost, cod,
    minPrice, recommendedPrice, aggressivePrice, premiumPrice,
    netProfit, netMargin, breakEven, grossMargin,
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
