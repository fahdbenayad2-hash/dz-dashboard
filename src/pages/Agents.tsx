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
import { getAgentDataTracking, getAgentDailyStats, getAgentLast7Days, getAgentDailyVsMonthlyAvg } from '@/lib/dashboardMetrics';

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

  const agentTrackingOrders = useMemo(() => {
    if (!selectedAgent) return [];
    return trackingOrders
      .filter(t => t.agent === selectedAgent)
      .sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return b.date.getTime() - a.date.getTime();
      });
  }, [trackingOrders, selectedAgent]);

  const agentChartData = useMemo(() => {
    if (!selectedAgent || agentTrackingOrders.length === 0) return null;

    const statusCounts = { delivered: 0, returned: 0, transit: 0, delivery: 0, others: 0 };
    agentTrackingOrders.forEach(t => { statusCounts[t.statusCategory]++; });

    const last30Days = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().slice(0, 10);
    });
    const dailyCounts = last30Days.map(day =>
      agentTrackingOrders.filter(t => t.date && t.date.toISOString().slice(0, 10) === day).length
    );

    const wilayaMap = new Map<string, number>();
    agentTrackingOrders.forEach(t => {
      if (t.wilaya) wilayaMap.set(t.wilaya, (wilayaMap.get(t.wilaya) || 0) + 1);
    });
    const topWilayas = [...wilayaMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    return { statusCounts, last30Days, dailyCounts, topWilayas };
  }, [agentTrackingOrders, selectedAgent]);

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
                    labels={['تم التوصيل', 'مرتجع', 'قيد الشحن', 'جاري التوزيع', 'أخرى']}
                    values={[
                      agentChartData.statusCounts.delivered,
                      agentChartData.statusCounts.returned,
                      agentChartData.statusCounts.transit,
                      agentChartData.statusCounts.delivery,
                      agentChartData.statusCounts.others,
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
                    {agentTrackingOrders.slice(0, 10).map(t => (
                      <TableRow key={t.orderId}>
                        <TableCell className="tabular-nums">{t.orderId}</TableCell>
                      <TableCell>{t.customer}</TableCell>
                      <TableCell>{t.wilaya}</TableCell>
                      <TableCell className="max-w-48 truncate">{t.product}</TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(t.total)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          t.statusCategory === 'delivered' ? 'success' :
                          t.statusCategory === 'returned' ? 'danger' : 'warning'
                        }>
                          {t.trackingStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── FEAT-5: المتابعة اليومية ─── */}
      {(() => {
        const todayKey = new Date().toISOString().slice(0, 10);
        const todayStats = getAgentDailyStats(trackingOrders, todayKey);
        const last7Days = getAgentLast7Days(trackingOrders);
        return (
          <>
            <Card>
              <CardHeader>
                <CardTitle>المتابعة اليومية — {new Date().toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الوكيل</TableHead>
                        <TableHead>طلبات اليوم</TableHead>
                        <TableHead>مسلّم اليوم</TableHead>
                        <TableHead>مرتجع اليوم</TableHead>
                        <TableHead>إيراد اليوم</TableHead>
                        <TableHead>معدل الإرجاع</TableHead>
                        <TableHead>vs المتوسط الشهري</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayStats.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-[var(--color-text-muted)] py-8">
                            لا توجد طلبات اليوم بعد
                          </TableCell>
                        </TableRow>
                      ) : todayStats.map(a => {
                        const vs = getAgentDailyVsMonthlyAvg(trackingOrders, a.name);
                        return (
                          <TableRow key={a.name}>
                            <TableCell className="font-medium">{a.name}</TableCell>
                            <TableCell className="tabular-nums font-bold">{a.orders}</TableCell>
                            <TableCell className="tabular-nums text-[var(--color-success)]">{a.delivered}</TableCell>
                            <TableCell className="tabular-nums text-[var(--color-danger)]">{a.returned}</TableCell>
                            <TableCell className="tabular-nums">{formatCurrency(a.revenue)}</TableCell>
                            <TableCell>
                              {a.cancellationRate !== null ? (
                                <span className={`tabular-nums font-medium ${a.cancellationRate > 40 ? 'text-[var(--color-danger)]' : a.cancellationRate > 25 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}`}>
                                  {a.cancellationRate.toFixed(1)}%
                                </span>
                              ) : <span className="text-[var(--color-text-muted)] text-xs">لم يُحسم</span>}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${vs.performanceVsAvg >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                                {vs.performanceVsAvg >= 0 ? '↑' : '↓'}
                                {Math.abs(vs.performanceVsAvg).toFixed(0)}%
                                <span className="text-[var(--color-text-muted)] font-normal">(متوسط {vs.dailyAvgOrders.toFixed(1)}/يوم)</span>
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>أداء الوكلاء — آخر 7 أيام</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الوكيل</TableHead>
                        {last7Days.map(d => <TableHead key={d.date} className="tabular-nums text-center">{d.label}</TableHead>)}
                        <TableHead>المجموع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agents.map(agent => {
                        const dailyCounts = last7Days.map(d =>
                          d.agents.find(a => a.name === agent.name)?.orders || 0
                        );
                        const total7d = dailyCounts.reduce((s, n) => s + n, 0);
                        return (
                          <TableRow key={agent.name}>
                            <TableCell className="font-medium">{agent.name}</TableCell>
                            {dailyCounts.map((count, i) => (
                              <TableCell key={i} className={`tabular-nums text-center ${count === 0 ? 'text-[var(--color-text-muted)]' : count >= 5 ? 'text-[var(--color-success)] font-medium' : ''}`}>
                                {count || '—'}
                              </TableCell>
                            ))}
                            <TableCell className="tabular-nums font-bold">{total7d}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        );
      })()}
    </div>
  );
}
