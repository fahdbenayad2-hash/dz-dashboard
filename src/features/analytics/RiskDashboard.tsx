import { useMemo } from 'react';
import type { TrackingOrder } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { RiskMeter } from '@/components/shared/RiskMeter';
import { useDailyHistory } from '@/hooks/useDailyHistory';
import { getHighRiskOrders } from '@/features/analytics/getHighRiskOrders';
import { detectAnomalies } from '@/features/analytics/detectAnomalies';
import { predictDailyRisk } from '@/lib/aiRiskEngine';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface RiskDashboardProps {
  trackingOrders: TrackingOrder[];
}

export function RiskDashboard({ trackingOrders }: RiskDashboardProps) {
  const { snapshots } = useDailyHistory(trackingOrders);

  const highRiskOrders = useMemo(() => {
    return getHighRiskOrders(trackingOrders, trackingOrders, snapshots, 60);
  }, [trackingOrders, snapshots]);

  const avgRiskScore = useMemo(() => {
    if (highRiskOrders.length === 0) return 0;
    const total = highRiskOrders.reduce((s, o) => s + o.assessment.score, 0);
    return Math.round(total / highRiskOrders.length);
  }, [highRiskOrders]);

  const prediction = useMemo(() => {
    return predictDailyRisk(snapshots);
  }, [snapshots]);

  const anomalies = useMemo(() => {
    return detectAnomalies(trackingOrders, snapshots);
  }, [trackingOrders, snapshots]);

  const levelText = useMemo(() => {
    if (avgRiskScore >= 80) return 'حرج';
    if (avgRiskScore >= 60) return 'مرتفع';
    if (avgRiskScore >= 40) return 'متوسط';
    return 'منخفض';
  }, [avgRiskScore]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">مركز المخاطر AI</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>مؤشر المخاطر العام</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <RiskMeter score={avgRiskScore} level={levelText} size="lg" />
            <p className="text-xs text-[var(--color-text-muted)] mt-4">
              بناءً على {highRiskOrders.length} طلب عالي الخطورة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>توقعات اليوم</CardTitle>
          </CardHeader>
          <CardContent>
            {prediction ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                    <p className="text-xs text-[var(--color-text-muted)]">متوقع الطلبات</p>
                    <p className="text-xl font-bold">{prediction.predictedOrders}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                    <p className="text-xs text-[var(--color-text-muted)]">متوقع التوصيل</p>
                    <p className="text-xl font-bold text-[var(--color-success)]">{prediction.predictedDelivered}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                    <p className="text-xs text-[var(--color-text-muted)]">متوقع الإرجاع</p>
                    <p className="text-xl font-bold text-[var(--color-danger)]">{prediction.predictedReturned}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                    <p className="text-xs text-[var(--color-text-muted)]">متوقع الإيراد</p>
                    <p className="text-xl font-bold text-[var(--color-success)]">{formatCurrency(prediction.predictedRevenue)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  {prediction.confidence === 'high' && <TrendingUp className="h-4 w-4 text-[var(--color-success)]" />}
                  {prediction.confidence === 'low' && <TrendingDown className="h-4 w-4 text-[var(--color-warning)]" />}
                  {prediction.confidence === 'medium' && <TrendingUp className="h-4 w-4 text-[var(--color-primary)]" />}
                  <span>
                    مستوى الثقة: <strong>{prediction.confidence === 'high' ? 'عالية' : prediction.confidence === 'medium' ? 'متوسطة' : 'منخفضة'}</strong>
                    {' — '}بناءً على {prediction.basedOnDays} يوم
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-[var(--color-text-muted)]">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">لا توجد بيانات كافية. احفظ snapshots يومية للتوقع.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الطلبات عالية الخطورة ({highRiskOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {highRiskOrders.length === 0 ? (
            <p className="text-center py-8 text-[var(--color-text-muted)]">لا توجد طلبات عالية الخطورة حالياً.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العميل</TableHead>
                    <TableHead>الولاية</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>المستوى</TableHead>
                    <TableHead>السبب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {highRiskOrders.slice(0, 50).map((item, i) => (
                    <TableRow key={item.order.orderId || i}
                      className={item.assessment.level === 'critical' ? 'bg-[var(--color-danger)]/15' : item.assessment.level === 'high' ? 'bg-[var(--color-warning)]/15' : ''}
                    >
                      <TableCell className="font-medium">{item.order.customer || '—'}</TableCell>
                      <TableCell>{item.order.wilaya}</TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(item.order.total)}</TableCell>
                      <TableCell>
                        <span className="tabular-nums font-bold" style={{ color: item.assessment.color }}>
                          {item.assessment.score}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium" style={{ color: item.assessment.color }}>
                          {item.assessment.level === 'critical' ? 'حرج' : item.assessment.level === 'high' ? 'مرتفع' : item.assessment.level === 'medium' ? 'متوسط' : 'منخفض'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--color-text-muted)]">
                        {item.assessment.factors.map(f => f.detail).join(' | ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الشذوذات المكتشفة ({anomalies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {anomalies.length === 0 ? (
            <p className="text-center py-8 text-[var(--color-text-muted)]">لا شذوذات مكتشفة</p>
          ) : (
            <div className="space-y-3">
              {anomalies.map((a, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                  <span className="text-lg shrink-0">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.reason}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {a.date} — {a.metric} — Z-Score: {a.zScore.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
