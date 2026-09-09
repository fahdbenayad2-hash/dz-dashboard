import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  Package,
  PackageSearch,
  Shield,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';

export interface NavigationItem {
  to: string;
  icon: LucideIcon;
  label: string;
  description: string;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: 'نظرة عامة',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم', description: 'ملخص النشاط والإجراءات المطلوبة' },
    ],
  },
  {
    label: 'العمليات',
    items: [
      { to: '/orders', icon: ClipboardList, label: 'الطلبات المعلقة', description: 'متابعة الطلبات غير المؤكدة' },
      { to: '/tracking', icon: Package, label: 'التتبع', description: 'حالات الشحن والتوصيل' },
      { to: '/agents', icon: Users, label: 'الوكلاء', description: 'أداء فريق التأكيد' },
    ],
  },
  {
    label: 'التحليلات',
    items: [
      { to: '/products', icon: PackageSearch, label: 'المنتجات والتسعير', description: 'أداء المنتجات وحساب السعر' },
      { to: '/product-analysis', icon: FlaskConical, label: 'تحليل المنتج', description: 'تحليل مفصل للمنتجات' },
      { to: '/daily-trends', icon: TrendingUp, label: 'الاتجاهات اليومية', description: 'تغير الأداء عبر الأيام' },
      { to: '/monthly-report', icon: CalendarDays, label: 'تقرير الشهر', description: 'ملخص ومقارنة شهرية' },
      { to: '/yearly-report', icon: CalendarRange, label: 'تقرير العام', description: 'الاتجاه السنوي والأرباع' },
    ],
  },
  {
    label: 'المخاطر',
    items: [
      { to: '/risk', icon: ShieldAlert, label: 'مركز المخاطر', description: 'المشاكل التي تحتاج تدخلاً' },
      { to: '/risk-dashboard', icon: Shield, label: 'التحليل المتقدم', description: 'تفاصيل عوامل المخاطر' },
    ],
  },
  {
    label: 'الإعدادات',
    items: [
      { to: '/notifications', icon: Bell, label: 'الإشعارات', description: 'قواعد وتنبيهات Telegram' },
    ],
  },
];

export const navigationItems = navigationGroups.flatMap(group => group.items);

export function getRouteMeta(pathname: string): Pick<NavigationItem, 'label' | 'description'> {
  return navigationItems.find(item => item.to === pathname) ?? navigationItems[0];
}
