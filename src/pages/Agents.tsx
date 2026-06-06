import { useMemo, useState } from 'react';
import type { Order, TrackingOrder, AgentData, AgentBadge } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils';
import { Star, ThumbsUp, AlertTriangle, Flame } from 'lucide-react';
import { getAgentDataTracking } from '@/lib/dashboardMetrics';

function useAgentData(trackingOrders: TrackingOrder[]) {
  return useMemo(() => {
    const data = getAgentDataTracking(trackingOrders);
    return data.map((d): AgentData => {
      const cancelRate = d.cancellationRate;
      let badge: AgentBadge = 'average';
      if (cancelRate < 20 && d.totalOrders > 10) badge = 'top';
      else if (cancelRate < 30) badge = 'good';
      else if (cancelRate > 40) badge = 'poor';
      return { ...d, badge };
    });
  }, [trackingOrders]);
}

const badgeConfig: Record<AgentBadge, { icon: typeof Star; label: string; color: string }> = {
  top: { icon: Star, label: 'ممتاز', color: '#1D9E75' },
  good: { icon: ThumbsUp, label: 'جيد', color: '#378ADD' },
  average: { icon: AlertTriangle, label: 'متوسط', color: '#EF9F27' },
  poor: { icon: Flame, label: 'ضعيف', color: '#E24B4A' },
};

export function Agents({ orders, trackingOrders }: { orders: Order[]; trackingOrders: TrackingOrder[] }) {
  const agents = useAgentData(trackingOrders.length > 0 ? trackingOrders : orders as unknown as TrackingOrder[]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const agentOrders = useMemo(() => {
    if (!selectedAgent) return [];
    return orders.filter(o => o.agent === selectedAgent).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, selectedAgent]);

  const agentChartData = useMemo(() => {
    if (!selectedAgent || agentOrders.length === 0) return null;

    const statusCounts = { Confirmed: 0, Failed: 0, Pending: 0, Waiting: 0 };
    agentOrders.forEach(o => {
      if (o.status in statusCounts) statusCounts[o.status as keyof typeof statusCounts]++;
    });

    const last30Days = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().slice(0, 10);
    });
    const dailyCounts = last30Days.map(day =>
      agentOrders.filter(o => o.date?.startsWith(day)).length
    );

    const wilayaMap = new Map<string, number>();
    agentOrders.forEach(o => {
      if (o.wilaya) wilayaMap.set(o.wilaya, (wilayaMap.get(o.wilaya) || 0) + 1);
    });
    const topWilayas = [...wilayaMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    return { statusCounts, last30Days, dailyCounts, topWilayas };
  }, [agentOrders, selectedAgent]);

  return (
    <div className="space-y-6">
      {/* Agent Leaderboard */}
      <Card>
        <CardHeader><CardTitle>ترتيب الوكلاء</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوكيل</TableHead>
                  <TableHead>إجمالي الطلبات</TableHead>
                  <TableHead>المؤكدة</TableHead>
                  <TableHead>الفاشلة</TableHead>
                  <TableHead>معدل الإلغاء</TableHead>
                  <TableHead>الإيراد</TableHead>
                  <TableHead>متوسط الطلب</TableHead>
                  <TableHead>الأداء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map(a => {
                  const cfg = badgeConfig[a.badge];
                  const Icon = cfg.icon;
                  return (
                    <TableRow
                      key={a.name}
                      className={`cursor-pointer ${selectedAgent === a.name ? 'bg-[var(--color-primary)]/5' : ''}`}
                      onClick={() => setSelectedAgent(a.name)}
                    >
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="tabular-nums">{formatNumber(a.totalOrders)}</TableCell>
                      <TableCell className="tabular-nums text-[var(--color-success)]">{formatNumber(a.confirmedOrders)}</TableCell>
                      <TableCell className="tabular-nums text-[var(--color-danger)]">{formatNumber(a.failedOrders)}</TableCell>
                      <TableCell>
                        <span className={`tabular-nums font-medium ${
                          a.cancellationRate > 40 ? 'text-[var(--color-danger)]' :
                          a.cancellationRate > 30 ? 'text-[var(--color-warning)]' :
                          'text-[var(--color-success)]'
                        }`}>
                          {formatPercent(a.cancellationRate)}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(a.totalRevenue)}</TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(a.avgOrderValue)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: cfg.color }}>
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {agents.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-[var(--color-text-muted)] py-8">لا يوجد وكلاء</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Agent Detail */}
      {selectedAgent && agentChartData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>طلبات {selectedAgent} (آخر 30 يوم)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <LineChart
                    labels={agentChartData.last30Days.map(d => d.slice(5))}
                    datasets={[{ label: 'عدد الطلبات', data: agentChartData.dailyCounts }]}
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>توزيع حالات الطلبات</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <DonutChart
                    labels={['مؤكد', 'فاشل', 'قيد الانتظار', 'بانتظار']}
                    values={[
                      agentChartData.statusCounts.Confirmed,
                      agentChartData.statusCounts.Failed,
                      agentChartData.statusCounts.Pending,
                      agentChartData.statusCounts.Waiting,
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {agentChartData.topWilayas.length > 0 && (
            <Card>
              <CardHeader><CardTitle>أفضل الولايات لـ {selectedAgent}</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <BarChart
                    labels={agentChartData.topWilayas.map(w => w[0])}
                    values={agentChartData.topWilayas.map(w => w[1])}
                    color="#7F77DD"
                    horizontal
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>آخر طلبات {selectedAgent}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الطلب</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الولاية</TableHead>
                      <TableHead>المنتج</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentOrders.slice(0, 10).map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="tabular-nums">{o.id}</TableCell>
                      <TableCell>{o.customer}</TableCell>
                      <TableCell>{o.wilaya}</TableCell>
                      <TableCell className="max-w-48 truncate">{o.product}</TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(o.total)}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
