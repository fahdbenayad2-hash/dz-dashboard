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

// ── تحليل المنتج المتقدم ──

export interface ProductExpenses {
  adSpend: number;
  otherExpenses: number;
  expenseNotes: string;
  unitCost: number;
  unitPrice: number;
  shippingFeePerOrder: number;
  returnFeePerOrder: number;
  packagingCostPerOrder: number;
}

export interface ProductPeriodFilter {
  productName: string;
  dateFrom: string;
  dateTo: string;
}

export interface ProductPeriodData {
  totalOrders: number;
  delivered: number;
  returned: number;
  inProgress: number;
  others: number;
  settledCount: number;
  cancellationRate: number;
  deliveryRate: number;
  grossRevenue: number;
  deliveryCostPaid: number;
  netRevenue: number;
  returnShippingLoss: number;
  returnedProductValue: number;
  avgOrderValue: number;
  avgDeliveryCost: number;
  daysInPeriod: number;
  avgDailyOrders: number;
  dailyTrend: { date: string; orders: number; delivered: number; revenue: number }[];
  topWilayas: { wilaya: string; orders: number; delivered: number; deliveryRate: number }[];
}

export interface ProductFinancialAnalysis {
  period: ProductPeriodData;
  expenses: ProductExpenses;
  totalInvestment: number;
  totalCost: number;
  grossProfit: number;
  netProfit: number;
  netMargin: number;
  roas: number;
  cpa: number;
  breakEvenOrders: number;
  totalCOGS: number;
  totalShippingPaid: number;
  totalPackaging: number;
  returnTotalCost: number;
  variableCostPerOrder: number;
  profitPerUnit: number;
  trueNetProfit: number;
  trueNetMargin: number;
  breakEvenUnits: number;
  roi: number;
  decision: 'scale' | 'optimize' | 'monitor' | 'stop';
  decisionLabel: string;
  decisionColor: string;
  decisionReasons: string[];
  actionPlan: string[];
}

export interface WilayaAnalysis {
  wilaya: string;
  orders: number;
  delivered: number;
  returned: number;
  inProgress: number;
  deliveryRate: number;
  revenue: number;
  netRevenue: number;
  profitContribution: number;
  avgOrderValue: number;
  returnCost: number;
  score: number;
  tier: 'A' | 'B' | 'C' | 'D';
}

export interface CompetitorData {
  competitorPrice: number;
  marketAvgDeliveryRate: number;
  marketAvgCPA: number;
}

export interface CompetitiveAnalysis {
  priceGap: number;
  deliveryAdvantage: number;
  cpaEfficiency: number;
  competitiveScore: number;
  position: 'leader' | 'strong' | 'average' | 'danger';
  positionLabel: string;
  positionColor: string;
  advantages: string[];
  weaknesses: string[];
  recommendations: string[];
}

// ── AI Risk Engine ──

export interface DailySnapshot {
  date: string;
  totalOrders: number;
  delivered: number;
  returned: number;
  totalRevenue: number;
}

export interface OrderRiskAssessment {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  color: string;
  factors: { label: string; impact: number; detail: string }[];
  wilayaRisk: number;
  amountRisk: number;
}

export interface CustomerRiskAssessment {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  color: string;
  totalOrders: number;
  returnedOrders: number;
  returnRate: number;
}

export interface DailyRiskPrediction {
  predictedOrders: number;
  predictedDelivered: number;
  predictedReturned: number;
  predictedRevenue: number;
  confidence: 'low' | 'medium' | 'high';
  confidenceScore: number;
  basedOnDays: number;
}

// ── Storage Manager ──

export interface StoredSnapshot {
  id: string;
  createdAt: string;
  data: unknown;
  sizeBytes: number;
}

export interface StorageStatus {
  usedBytes: number;
  usedPercentage: number;
  snapshotCount: number;
  oldestSnapshot: string | null;
  newestSnapshot: string | null;
}

// ── Telegram Notifier ──

export type NotificationType =
  | 'daily_report'
  | 'risk_alert'
  | 'low_stock'
  | 'order_anomaly';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface FilterState {
  search: string;
  statusFilter: OrderStatus[];
  wilayaFilter: string[];
  agentFilter: string[];
  dateRange: { from: string; to: string } | null;
  totalMin: number | null;
  totalMax: number | null;
}
