import { Badge } from '@/components/ui/badge';

const statusMap: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'purple' }> = {
  Confirmed: { label: 'مؤكد', variant: 'success' },
  Failed: { label: 'فاشل', variant: 'danger' },
  Pending: { label: 'قيد الانتظار', variant: 'warning' },
  Waiting: { label: 'بانتظار', variant: 'purple' },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusMap[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
