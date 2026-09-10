import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, LogOut, Menu, X } from 'lucide-react';
import { classNames } from '@/lib/utils';
import { navigationGroups } from '@/config/navigation';

interface SidebarProps {
  desktopCollapsed: boolean;
  mobileOpen: boolean;
  onToggleDesktop: () => void;
  onCloseMobile: () => void;
  onLogout: () => void;
}

export function Sidebar({ desktopCollapsed, mobileOpen, onToggleDesktop, onCloseMobile, onLogout }: SidebarProps) {
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        dir="rtl"
        className={classNames(
          'fixed right-0 top-0 z-40 flex h-dvh w-72 flex-col border-l border-white/10 bg-[var(--color-sidebar)] shadow-2xl md:shadow-none',
          'transition-transform duration-300 ease-in-out motion-reduce:transition-none',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
          'md:translate-x-0 md:transition-[width] md:duration-300',
          desktopCollapsed ? 'md:w-20' : 'md:w-64',
        )}
        aria-label="التنقل الرئيسي"
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-black text-white">DZ</div>
          <div className={classNames('min-w-0 flex-1', desktopCollapsed && 'md:hidden')}>
            <p className="whitespace-nowrap text-base font-bold text-white">DZ Commerce</p>
            <p className="text-[10px] text-[var(--color-sidebar-text)]">منصة ذكاء التجارة</p>
          </div>
          <button
            onClick={onCloseMobile}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-white md:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navigationGroups.map(group => (
            <div key={group.label}>
              <p className={classNames('mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500', desktopCollapsed && 'md:sr-only')}>
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onCloseMobile}
                    title={desktopCollapsed ? item.label : undefined}
                    className={({ isActive }) => classNames(
                      'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                      isActive
                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                        : 'text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-white',
                      desktopCollapsed && 'md:justify-center md:px-0',
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className={classNames('truncate', desktopCollapsed && 'md:hidden')}>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/10 p-3">
          <button
            onClick={onToggleDesktop}
            className={classNames(
              'hidden min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--color-sidebar-text)] transition-colors hover:bg-[var(--color-sidebar-hover)] hover:text-white md:flex',
              desktopCollapsed && 'justify-center px-0',
            )}
            aria-label={desktopCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
            aria-expanded={!desktopCollapsed}
          >
            {desktopCollapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            {!desktopCollapsed && <span>طي القائمة</span>}
          </button>
          <button
            onClick={onLogout}
            className={classNames(
              'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--color-sidebar-text)] transition-colors hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-danger)]',
              desktopCollapsed && 'md:justify-center md:px-0',
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={classNames(desktopCollapsed && 'md:hidden')}>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
}
