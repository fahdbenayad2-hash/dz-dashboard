import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, PackageSearch, Users, ClipboardList, ShieldAlert,
  CalendarDays, Menu, LogOut,
} from 'lucide-react';
import { classNames } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم' },
  { to: '/monthly-report', icon: CalendarDays, label: 'تقرير الشهر الأخير' },
  { to: '/products', icon: PackageSearch, label: 'المنتجات والتسعير' },
  { to: '/agents', icon: Users, label: 'الوكلاء' },
  { to: '/orders', icon: ClipboardList, label: 'الطلبات' },
  { to: '/risk', icon: ShieldAlert, label: 'مركز المخاطر' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

export function Sidebar({ collapsed, onToggle, onLogout }: SidebarProps) {
  return (
    <aside
      dir="rtl"
      className={classNames(
        'fixed right-0 top-0 z-40 h-screen bg-[var(--color-sidebar)] border-l border-[var(--color-border)] transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-64',
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
  );
}
