import type { PricingInputs, PricingResult, CostBreakdown } from '@/types';

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
