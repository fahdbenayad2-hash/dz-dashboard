import { useState, useMemo } from 'react';
import type { PricingInputs, PricingResult } from '@/types';
import { calculatePricing } from '@/lib/financialEngine';
import { getRiskDetail } from '@/lib/riskScore';

const defaultInputs: PricingInputs = {
  fabricPricePerMeter: 450,
  fabricMeters: 2.5,
  sewingCost: 400,
  accessoriesCost: 50,
  storageCost: 58,
  packagingCost: 50,
  shippingFee: 300,
  returnCost: 300,
  codType: 'percentage',
  codValue: 3.5,
  adCostPerOrder: 500,
  cancellationRate: 37,
  desiredProfit: 500,
};

export function usePricing(initialInputs?: Partial<PricingInputs>) {
  const [inputs, setInputs] = useState<PricingInputs>({ ...defaultInputs, ...initialInputs });

  const result = useMemo(() => calculatePricing(inputs), [inputs]);
  const riskDetail = useMemo(() => getRiskDetail(inputs, result), [inputs, result]);

  const updateInput = <K extends keyof PricingInputs>(key: K, value: PricingInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const resetInputs = () => {
    setInputs({ ...defaultInputs, ...initialInputs });
  };

  return {
    inputs, result, riskDetail, updateInput, resetInputs,
  };
}
