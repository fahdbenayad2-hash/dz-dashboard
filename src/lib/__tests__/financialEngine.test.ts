import { describe, it, expect } from 'vitest';
import {
  calculateProductCost,
  calculateLogisticsCost,
  calculateReturnLoss,
  calculateBaseCost,
  calculateCODRate,
  calculateRawPrice,
  calculateCOD,
  toX990Price,
  calculateRecommendedPrice,
  calculateProfit,
  calculateMargin,
  calculatePricing,
} from '../financialEngine';
import type { PricingInputs } from '@/types';

const sampleInputs: PricingInputs = {
  fabricPricePerMeter: 500,
  fabricMeters: 2,
  sewingCost: 800,
  accessoriesCost: 300,
  storageCost: 100,
  packagingCost: 150,
  shippingFee: 400,
  returnCost: 300,
  codType: 'percentage',
  codValue: 3.5,
  adCostPerOrder: 500,
  cancellationRate: 20,
  desiredProfit: 500,
};

describe('calculateProductCost', () => {
  it('calculates product cost', () => {
    expect(calculateProductCost(sampleInputs)).toBe(500 * 2 + 800 + 300); // 2100
  });
});

describe('calculateLogisticsCost', () => {
  it('calculates logistics cost', () => {
    expect(calculateLogisticsCost(sampleInputs)).toBe(100 + 150 + 400); // 650
  });
});

describe('calculateReturnLoss', () => {
  it('calculates return loss', () => {
    expect(calculateReturnLoss(sampleInputs)).toBe(300 * (20 / 100)); // 60
  });
});

describe('calculateBaseCost', () => {
  it('calculates base cost', () => {
    const expected = 2100 + 650 + 500 + 60; // 3310
    expect(calculateBaseCost(sampleInputs)).toBe(expected);
  });
});

describe('calculateCODRate', () => {
  it('calculates COD rate as decimal', () => {
    expect(calculateCODRate(sampleInputs)).toBe(0.035);
  });

  it('returns 0 for fixed COD', () => {
    expect(calculateCODRate({ ...sampleInputs, codType: 'fixed' })).toBe(0);
  });
});

describe('calculateRawPrice', () => {
  it('uses exact formula for percentage COD', () => {
    const rate = 0.035;
    const result = calculateRawPrice(3310, 500, rate, 'percentage', 3.5);
    const expected = (3310 + 500) / (1 - 0.035);
    expect(result).toBeCloseTo(expected, 10);
  });

  it('uses simple formula for fixed COD', () => {
    const result = calculateRawPrice(3310, 500, 0, 'fixed', 200);
    expect(result).toBe(3310 + 500 + 200);
  });
});

describe('toX990Price', () => {
  it('converts 2790 to 2990', () => expect(toX990Price(2790)).toBe(2990));
  it('converts 3490 to 3990', () => expect(toX990Price(3490)).toBe(3990));
  it('converts 4210 to 4990', () => expect(toX990Price(4210)).toBe(4990));
  it('converts 1000 to 990', () => expect(toX990Price(1000)).toBe(990));
  it('converts 1990 to 1990', () => expect(toX990Price(1990)).toBe(1990));
  it('converts 2000 to 1990', () => expect(toX990Price(2000)).toBe(1990));
});

describe('calculateCOD', () => {
  it('calculates percentage COD of price', () => {
    expect(calculateCOD(3990, sampleInputs)).toBeCloseTo(3990 * 0.035, 10);
  });

  it('calculates fixed COD', () => {
    expect(calculateCOD(3990, { ...sampleInputs, codType: 'fixed', codValue: 200 })).toBe(200);
  });
});

describe('calculateRecommendedPrice', () => {
  it('returns x990 price with profit >= target', () => {
    const price = calculateRecommendedPrice(3310, 500, sampleInputs);
    const cod = calculateCOD(price, sampleInputs);
    const netProfit = price - 3310 - cod;
    expect(price % 1000).toBe(990);
    expect(netProfit).toBeGreaterThanOrEqual(500);
  });
});

describe('calculateProfit', () => {
  it('calculates net profit', () => {
    expect(calculateProfit(3990, 3310, 139.65)).toBeCloseTo(3990 - 3310 - 139.65, 10);
  });
});

describe('calculateMargin', () => {
  it('calculates margin percentage', () => {
    const result = calculateMargin(540.35, 3990);
    expect(result).toBeCloseTo((540.35 / 3990) * 100, 10);
  });

  it('returns 0 when price is 0', () => {
    expect(calculateMargin(100, 0)).toBe(0);
  });
});

describe('calculatePricing — integration with exact formula', () => {
  it('returns valid recommendedPrice (x990)', () => {
    const result = calculatePricing(sampleInputs);
    expect(result.recommendedPrice % 1000).toBe(990);
    expect(result.recommendedPrice).toBeGreaterThan(0);
  });

  it('net profit equals recommendedPrice - baseCost - cod', () => {
    const result = calculatePricing(sampleInputs);
    const expectedProfit = result.recommendedPrice - result.baseCost - result.cod;
    expect(result.netProfit).toBeCloseTo(expectedProfit, 5);
  });

  it('net margin equals (netProfit / recommendedPrice) * 100', () => {
    const result = calculatePricing(sampleInputs);
    const expectedMargin = (result.netProfit / result.recommendedPrice) * 100;
    expect(result.netMargin).toBeCloseTo(expectedMargin, 5);
  });

  it('gross profit equals recommendedPrice - productCost', () => {
    const result = calculatePricing(sampleInputs);
    expect(result.grossProfit).toBeCloseTo(result.recommendedPrice - result.productCost, 5);
  });

  it('breakEven equals baseCost + cod', () => {
    const result = calculatePricing(sampleInputs);
    expect(result.breakEven).toBeCloseTo(result.baseCost + result.cod, 5);
  });

  it('price tiers are ordered: minPrice <= aggressive <= recommended <= premium', () => {
    const result = calculatePricing(sampleInputs);
    expect(result.minPrice).toBeLessThanOrEqual(result.aggressivePrice);
    expect(result.aggressivePrice).toBeLessThanOrEqual(result.recommendedPrice);
    expect(result.recommendedPrice).toBeLessThanOrEqual(result.premiumPrice);
  });
});

describe('calculatePricing — fixed COD', () => {
  const fixedInputs: PricingInputs = {
    ...sampleInputs,
    codType: 'fixed',
    codValue: 200,
  };

  it('uses fixed COD in calculations', () => {
    const result = calculatePricing(fixedInputs);
    expect(result.cod).toBe(200);
  });
});

describe('calculatePricing — manual sample verification', () => {
  // Given:
  //   product cost = 500*2 + 800 + 300 = 2100
  //   logistics   = 100 + 150 + 400 = 650
  //   return loss = 300 * 0.20 = 60
  //   base cost   = 2100 + 650 + 500 + 60 = 3310
  //   COD rate    = 3.5%
  //   desired profit = 500
  // Final price   = (3310 + 500) / (1 - 0.035) = 3810 / 0.965 ≈ 3948.19
  // x990           = ceil(3948.19/1000)*1000 - 10 = 4000 - 10 = 3990
  // COD at 3990    = 3990 * 0.035 = 139.65
  // Net profit     = 3990 - 3310 - 139.65 = 540.35
  // Net margin     = 540.35 / 3990 * 100 ≈ 13.54%
  // Gross profit   = 3990 - 2100 = 1890
  // Break even     = 3310 + 139.65 = 3449.65

  const result = calculatePricing(sampleInputs);

  it('productCost = 2100', () => expect(result.productCost).toBeCloseTo(2100, 5));
  it('fulfillmentCost (logistics) = 650', () => expect(result.fulfillmentCost).toBeCloseTo(650, 5));
  it('returnLoss = 60', () => expect(result.returnLoss).toBeCloseTo(60, 5));
  it('baseCost = 3310', () => expect(result.baseCost).toBeCloseTo(3310, 5));
  it('recommendedPrice = 3990', () => expect(result.recommendedPrice).toBe(3990));
  it('cod = 139.65', () => expect(result.cod).toBeCloseTo(139.65, 5));
  it('netProfit ≈ 540.35', () => expect(result.netProfit).toBeCloseTo(540.35, 1));
  it('netMargin ≈ 13.54%', () => expect(result.netMargin).toBeCloseTo(13.54, 1));
  it('grossProfit = 1890', () => expect(result.grossProfit).toBeCloseTo(1890, 5));
  it('breakEven ≈ 3449.65', () => expect(result.breakEven).toBeCloseTo(3449.65, 1));
});
