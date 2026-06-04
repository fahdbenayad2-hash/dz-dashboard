import type { PricingInputs, PricingResult, CostBreakdown } from '@/types';

/**
 * Product cost: fabric + sewing + accessories
 */
function calculateProductCost(inputs: PricingInputs): number {
  return inputs.fabricPricePerMeter * inputs.fabricMeters + inputs.sewingCost + inputs.accessoriesCost;
}

/**
 * Fulfillment cost: storage + packaging + shipping
 */
function calculateFulfillmentCost(inputs: PricingInputs): number {
  return inputs.storageCost + inputs.packagingCost + inputs.shippingFee;
}

/**
 * Expected return loss per order: returnCost × cancellationRate%
 */
function calculateReturnLoss(inputs: PricingInputs): number {
  return inputs.returnCost * (inputs.cancellationRate / 100);
}

/**
 * Base cost before COD and profit: product + fulfillment + ads + return loss
 */
function calculateBaseCost(inputs: PricingInputs): number {
  return calculateProductCost(inputs) + calculateFulfillmentCost(inputs) + inputs.adCostPerOrder + calculateReturnLoss(inputs);
}

/**
 * COD fee for a given selling price
 * - percentage: price × (codValue / 100)
 * - fixed: codValue
 */
function calculateCodFee(price: number, codType: PricingInputs['codType'], codValue: number): number {
  return codType === 'percentage' ? price * (codValue / 100) : codValue;
}

/**
 * Iterative COD convergence (4 iterations)
 * Since COD fee depends on the final price (which includes COD),
 * we iterate: price = baseCost + cod + profit, then cod = fee(price)
 * 4 iterations is enough for sub-1 DZD convergence.
 */
function convergeCod(baseCost: number, desiredProfit: number, codType: PricingInputs['codType'], codValue: number): number {
  let cod = 0;
  for (let i = 0; i < 4; i++) {
    const price = baseCost + cod + desiredProfit;
    cod = calculateCodFee(price, codType, codValue);
  }
  return cod;
}

/**
 * Round price to nearest 1000 minus 10 (x990 pricing convention)
 * e.g. 2790 → 2990, 3120 → 3990
 */
function toX990Price(price: number): number {
  return Math.ceil(price / 1000) * 1000 - 10;
}

/**
 * Minimum viable price covering all costs + desired profit (before rounding)
 */
function calculateMinPrice(baseCost: number, codAtMinPrice: number, desiredProfit: number): number {
  return baseCost + codAtMinPrice + desiredProfit;
}

/**
 * Price tier with correct COD recalculation
 */
function calculatePriceTier(
  baseCost: number,
  profitMultiplier: number,
  desiredProfit: number,
  codType: PricingInputs['codType'],
  codValue: number,
): number {
  const profitTarget = desiredProfit * profitMultiplier;
  const cod = convergeCod(baseCost, profitTarget, codType, codValue);
  const rawPrice = baseCost + cod + profitTarget;
  return toX990Price(rawPrice);
}

export function calculatePricing(inputs: PricingInputs): PricingResult {
  const productCost = calculateProductCost(inputs);
  const fulfillmentCost = calculateFulfillmentCost(inputs);
  const returnLoss = calculateReturnLoss(inputs);
  const baseCost = calculateBaseCost(inputs);

  const codAtMinPrice = convergeCod(baseCost, inputs.desiredProfit, inputs.codType, inputs.codValue);
  const minPrice = calculateMinPrice(baseCost, codAtMinPrice, inputs.desiredProfit);
  const recommendedPrice = toX990Price(minPrice);

  const codAtRecommended = calculateCodFee(recommendedPrice, inputs.codType, inputs.codValue);
  const aggressivePrice = calculatePriceTier(baseCost, 0.7, inputs.desiredProfit, inputs.codType, inputs.codValue);
  const premiumPrice = calculatePriceTier(baseCost, 1.5, inputs.desiredProfit, inputs.codType, inputs.codValue);

  const netProfit = recommendedPrice - baseCost - codAtRecommended;
  const netMargin = (netProfit / recommendedPrice) * 100;
  const breakEven = baseCost + codAtRecommended;
  const grossMargin = ((recommendedPrice - productCost) / recommendedPrice) * 100;

  const totalBreakdown = productCost + fulfillmentCost + inputs.adCostPerOrder + returnLoss + codAtRecommended + netProfit;

  const costBreakdown: CostBreakdown = {
    product: { value: productCost, percentage: totalBreakdown > 0 ? (productCost / totalBreakdown) * 100 : 0 },
    logistics: { value: fulfillmentCost, percentage: totalBreakdown > 0 ? (fulfillmentCost / totalBreakdown) * 100 : 0 },
    ads: { value: inputs.adCostPerOrder, percentage: totalBreakdown > 0 ? (inputs.adCostPerOrder / totalBreakdown) * 100 : 0 },
    returns: { value: returnLoss, percentage: totalBreakdown > 0 ? (returnLoss / totalBreakdown) * 100 : 0 },
    cod: { value: codAtRecommended, percentage: totalBreakdown > 0 ? (codAtRecommended / totalBreakdown) * 100 : 0 },
    profit: { value: netProfit, percentage: totalBreakdown > 0 ? (netProfit / totalBreakdown) * 100 : 0 },
  };

  const riskScore = calculateRiskScore(inputs.cancellationRate, netMargin, inputs.adCostPerOrder, recommendedPrice, inputs.shippingFee);
  const riskLevel = riskScore >= 80 ? 'منخفض' : riskScore >= 50 ? 'متوسط' : 'مرتفع';
  const riskColor = riskScore >= 80 ? '#1D9E75' : riskScore >= 50 ? '#EF9F27' : '#E24B4A';

  return {
    productCost, fulfillmentCost, returnLoss, baseCost,
    cod: codAtRecommended, minPrice, recommendedPrice, aggressivePrice, premiumPrice,
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
