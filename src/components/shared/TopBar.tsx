import { RefreshCw, Moon, Sun, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

interface TopBarProps {
  dark: boolean;
  onToggleDark: () => void;
  lastUpdated: Date | null;
  onRefresh: () => void;
  loading: boolean;
}

export function TopBar({ dark, onToggleDark, lastUpdated, onRefresh, loading }: TopBarProps) {
  const formatTime = (d: Date) => {
    return d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="h-16 border-b border-[var(--color-border)] bg-[var(--color-card)] flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-[var(--color-text)]">
          منصة ذكاء التجارة
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-success)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--color-success)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
          مباشر
        </span>
      </div>

      <div className="flex items-center gap-3">
        {lastUpdated && (
          <Tooltip content={`آخر تحديث: ${lastUpdated.toLocaleString('ar-DZ')}`}>
            <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] tabular-nums">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(lastUpdated)}
            </span>
          </Tooltip>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={classNames('h-4 w-4', loading && 'animate-spin')} />
          تحديث
        </Button>

        <Button variant="ghost" size="sm" onClick={onToggleDark}>
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
