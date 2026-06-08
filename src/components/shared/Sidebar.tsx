import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, PackageSearch, Users, ClipboardList, ShieldAlert,
  CalendarDays, CalendarRange, Menu, LogOut, Package, FlaskConical,
  TrendingUp, Shield, Bell,
} from 'lucide-react';
import { classNames } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم' },
  { to: '/monthly-report', icon: CalendarDays, label: 'تقارير الأشهر' },
  { to: '/products', icon: PackageSearch, label: 'المنتجات والتسعير' },
  { to: '/agents', icon: Users, label: 'الوكلاء' },
  { to: '/orders', icon: ClipboardList, label: 'الطلبات المعلقة' },
  { to: '/tracking', icon: Package, label: 'التتبع' },
  { to: '/yearly-report', icon: CalendarRange, label: 'تقرير العام' },
  { to: '/risk', icon: ShieldAlert, label: 'مركز المخاطر' },
  { to: '/product-analysis', icon: FlaskConical, label: 'تحليل المنتج' },
  { to: '/daily-trends', icon: TrendingUp, label: 'الاتجاهات اليومية' },
  { to: '/risk-dashboard', icon: Shield, label: 'مركز المخاطر AI' },
  { to: '/notifications', icon: Bell, label: 'الإشعارات' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

export function Sidebar({ collapsed, onToggle, onLogout }: SidebarProps) {
  console.log('[DZ-CHANGE] layout-mobile-fixed');
  console.log('[DZ-CHANGE] layout-desktop-fixed');

  useEffect(() => {
    if (!collapsed && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [collapsed]);

  return (
    <>
      {/* Mobile backdrop */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onToggle}
        />
      )}
      <aside
        dir="rtl"
        className={classNames(
          'fixed right-0 top-0 z-40 h-screen bg-[var(--color-sidebar)] border-l border-[var(--color-border)] flex flex-col w-64',
          // Mobile: slide drawer in/out using explicit w-64 width
          'transition-transform duration-300 ease-in-out',
          collapsed ? 'translate-x-full' : 'translate-x-0',
          // Desktop: always visible, animate width only
          'md:translate-x-0 md:transition-[width] md:duration-300',
          collapsed ? 'md:w-16' : 'md:w-64',
        )}
      >
        <div className="flex items-center h-16 px-4 border-b border-[var(--color-border)]">
          {!collapsed && (
            <span className="text-white font-semibold text-lg whitespace-nowrap">DZ Commerce</span>
          )}
          <button
            onClick={onToggle}
            className={classNames(
              'rounded-lg p-1.5 text-[var(--color-sidebar-text)] hover:text-white hover:bg-[var(--color-sidebar-hover)] transition-colors',
              collapsed ? 'mx-auto' : 'mr-auto',
            )}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                classNames(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--color-primary)]/20 text-white'
                    : 'text-[var(--color-sidebar-text)] hover:text-white hover:bg-[var(--color-sidebar-hover)]',
                  collapsed && 'justify-center',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-2 border-t border-[var(--color-border)]">
          <button
            onClick={onLogout}
            className={classNames(
              'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-[var(--color-sidebar-text)] hover:text-[var(--color-danger)] hover:bg-[var(--color-sidebar-hover)]',
              collapsed && 'justify-center',
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
