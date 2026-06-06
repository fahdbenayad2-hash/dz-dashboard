export type StatusCategory = 'delivered' | 'returned' | 'transit' | 'delivery' | 'others';

export interface TrackingOrder {
  orderId: string;
  date: Date | null;
  agent: string;
  customer: string;
  wilaya: string;
  trackingStatus: string;
  statusCategory: StatusCategory;
  product: string;
  total: number;
  delivery: number;
  driver: string;
}

export interface Order {
  id: number;
  date: string;
  customer: string;
  phone: string;
  wilaya: string;
  status: OrderStatus;
  product: string;
  total: number;
  delivery: number;
  agent: string;
}

export type OrderStatus = 'Confirmed' | 'Failed' | 'Pending' | 'Waiting';

export type CodType = 'percentage' | 'fixed';

export interface PricingInputs {
  fabricPricePerMeter: number;
  fabricMeters: number;
  sewingCost: number;
  accessoriesCost: number;
  storageCost: number;
  packagingCost: number;
  shippingFee: number;
  returnCost: number;
  codType: CodType;
  codValue: number;
  adCostPerOrder: number;
  cancellationRate: number;
  desiredProfit: number;
}

export interface PricingResult {
  productCost: number;
  fulfillmentCost: number;
  returnLoss: number;
  baseCost: number;
  cod: number;
  minPrice: number;
  recommendedPrice: number;
  aggressivePrice: number;
  premiumPrice: number;
  netProfit: number;
  netMargin: number;
  breakEven: number;
  grossProfit: number;
  grossMargin: number;
  costBreakdown: CostBreakdown;
  riskScore: number;
  riskLevel: string;
  riskColor: string;
}

export interface CostBreakdown {
  product: { value: number; percentage: number };
  logistics: { value: number; percentage: number };
  ads: { value: number; percentage: number };
  returns: { value: number; percentage: number };
  cod: { value: number; percentage: number };
  profit: { value: number; percentage: number };
}

export interface RiskFactor {
  label: string;
  currentValue: string;
  benchmark: string;
  penalty: number;
  recommendation: string;
}

export interface RiskDetail {
  score: number;
  level: string;
  color: string;
  factors: RiskFactor[];
  actionPlan: string[];
}

export interface AgentData {
  name: string;
  totalOrders: number;
  confirmedOrders: number;
  failedOrders: number;
  cancellationRate: number;
  totalRevenue: number;
  avgOrderValue: number;
  badge: AgentBadge;
}

export type AgentBadge = 'top' | 'good' | 'average' | 'poor';

export interface FilterState {
  search: string;
  statusFilter: OrderStatus[];
  wilayaFilter: string[];
  agentFilter: string[];
  dateRange: { from: string; to: string } | null;
  totalMin: number | null;
  totalMax: number | null;
}
