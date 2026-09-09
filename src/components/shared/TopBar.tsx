import { RefreshCw, Moon, Sun, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { classNames } from '@/lib/utils';
import { DataHealthIndicator } from '@/components/shared/DataHealthIndicator';
import { getRouteMeta } from '@/config/navigation';

interface TopBarProps {
  dark: boolean;
  onToggleDark: () => void;
  onRefresh: () => void;
  loading: boolean;
  onOpenSidebar: () => void;
  completedAt?: string;
  ordersUpdated: Date | null;
  trackingUpdated: Date | null;
  ordersError: string | null;
  trackingError: string | null;
  now: number;
}

export function TopBar(props: TopBarProps) {
  const { pathname } = useLocation();
  const route = getRouteMeta(pathname);

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/95 px-3 backdrop-blur sm:px-5 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={props.onOpenSidebar}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-gray-100 hover:text-[var(--color-text)] dark:hover:bg-gray-800 md:hidden"
          aria-label="فتح القائمة"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-[var(--color-text)] sm:text-lg">{route.label}</h1>
          <p className="hidden truncate text-xs text-[var(--color-text-muted)] lg:block">{route.description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <DataHealthIndicator
          completedAt={props.completedAt}
          ordersUpdated={props.ordersUpdated}
          trackingUpdated={props.trackingUpdated}
          ordersError={props.ordersError}
          trackingError={props.trackingError}
          now={props.now}
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={props.onRefresh}
          disabled={props.loading}
          aria-label="تحديث البيانات"
          className="min-h-10 px-2.5 sm:px-3"
        >
          <RefreshCw className={classNames('h-4 w-4', props.loading && 'animate-spin')} />
          <span className="hidden sm:inline">تحديث</span>
        </Button>

        <Button variant="ghost" size="sm" onClick={props.onToggleDark} aria-label={props.dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'} className="min-h-10 px-2.5">
          {props.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
