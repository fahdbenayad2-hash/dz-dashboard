import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/shared/Sidebar';
import { TopBar } from '@/components/shared/TopBar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Login } from '@/pages/Login';
import { useSheetData } from '@/hooks/useSheetData';
import { useTrackingData } from '@/hooks/useTrackingData';
import { useRemoteData } from '@/hooks/useRemoteData';
import { readPublishedData } from '@/lib/sheetsApi';
import { clearLegacyTelegramSecrets } from '@/lib/telegramNotifier';
import { useAutoSnapshot } from '@/hooks/useAutoSnapshot';
import { checkSession, logout } from '@/lib/auth';
import { classNames } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const Dashboard = lazy(() => import('@/pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Products = lazy(() => import('@/pages/Products').then(module => ({ default: module.Products })));
const Agents = lazy(() => import('@/pages/Agents').then(module => ({ default: module.Agents })));
const Orders = lazy(() => import('@/pages/Orders').then(module => ({ default: module.Orders })));
const Tracking = lazy(() => import('@/pages/Tracking').then(module => ({ default: module.Tracking })));
const RiskCenter = lazy(() => import('@/pages/RiskCenter').then(module => ({ default: module.RiskCenter })));
const MonthlyReport = lazy(() => import('@/pages/MonthlyReport').then(module => ({ default: module.MonthlyReport })));
const YearlyReport = lazy(() => import('@/pages/YearlyReport').then(module => ({ default: module.YearlyReport })));
const ProductAnalysis = lazy(() => import('@/pages/ProductAnalysis').then(module => ({ default: module.ProductAnalysis })));
const DailyTrends = lazy(() => import('@/features/analytics/DailyTrends').then(module => ({ default: module.DailyTrends })));
const RiskDashboard = lazy(() => import('@/features/analytics/RiskDashboard').then(module => ({ default: module.RiskDashboard })));
const NotificationSettings = lazy(() => import('@/features/analytics/NotificationSettings').then(module => ({ default: module.NotificationSettings })));

const fetchSyncMetadata = async () => { const data = await readPublishedData(); return [{ completedAt: data.completedAt, generation: data.generation }]; };

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  useEffect(() => { clearLegacyTelegramSecrets(); void checkSession().then(value => { setAuthenticated(value); setChecking(false); }); }, []);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => localStorage.getItem('dz-sidebar-collapsed') === 'true');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('dz-dark');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('dz-dark', String(dark));
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  useEffect(() => {
    localStorage.setItem('dz-sidebar-collapsed', String(desktopSidebarCollapsed));
  }, [desktopSidebarCollapsed]);

  const handleLogout = () => {
    void logout().then(() => setAuthenticated(false)).catch(() => alert("تعذّر إنهاء الجلسة. أعد المحاولة."));
  };

  if (checking) return <div role="status" className="p-8 text-center">جاري التحقق من الجلسة...</div>;

  if (!authenticated) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login onLogin={() => setAuthenticated(true)} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return <AuthenticatedApp
    desktopSidebarCollapsed={desktopSidebarCollapsed}
    setDesktopSidebarCollapsed={setDesktopSidebarCollapsed}
    mobileSidebarOpen={mobileSidebarOpen}
    setMobileSidebarOpen={setMobileSidebarOpen}
    dark={dark}
    setDark={setDark}
    onLogout={handleLogout}
  />;
}

function AuthenticatedApp({ desktopSidebarCollapsed, setDesktopSidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen, dark, setDark, onLogout }: {
  desktopSidebarCollapsed: boolean;
  setDesktopSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;
  dark: boolean;
  setDark: (v: boolean | ((prev: boolean) => boolean)) => void;
  onLogout: () => void;
}) {
  const { orders, loading, lastUpdated: ordersUpdated, refresh: refreshOrders, refreshing: ordersRefreshing, error: ordersError } = useSheetData();
  const { trackingOrders, trackingLoading, lastUpdated: trackingUpdated, refresh: refreshTracking, refreshing: trackingRefreshing, error: trackingError } = useTrackingData();
  const sync = useRemoteData(fetchSyncMetadata);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const refresh = () => { void Promise.all([refreshOrders(), refreshTracking(), sync.refresh()]); };
  const unavailable = !ordersUpdated || !trackingUpdated;

  useAutoSnapshot(trackingOrders, !trackingError && !!trackingUpdated && now - trackingUpdated.getTime() < 120000);

  if (loading || trackingLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-bg)]">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--color-primary)] mx-auto" />
          <p className="text-sm text-[var(--color-text-muted)]">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div dir="rtl" className="flex min-h-screen bg-[var(--color-bg)]">
        <Sidebar
          desktopCollapsed={desktopSidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onToggleDesktop={() => setDesktopSidebarCollapsed(value => !value)}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onLogout={onLogout}
        />
        <div
          className={classNames(
            'flex-1 flex flex-col min-w-0 overflow-x-hidden transition-all duration-300',
            desktopSidebarCollapsed ? 'md:mr-20' : 'md:mr-64',
          )}
        >
          <TopBar
            dark={dark}
            onToggleDark={() => setDark(d => !d)}
            onRefresh={refresh}
            loading={ordersRefreshing || trackingRefreshing}
            onOpenSidebar={() => setMobileSidebarOpen(true)}
            completedAt={sync.data[0]?.completedAt}
            ordersUpdated={ordersUpdated}
            trackingUpdated={trackingUpdated}
            ordersError={ordersError}
            trackingError={trackingError}
            now={now}
          />
          <main className="flex-1 overflow-x-hidden p-3 sm:p-4 lg:p-6">
            {(ordersError || trackingError) && (
              <div role="alert" className="mb-6 rounded-xl border border-red-400 bg-red-50 p-4 text-red-900">
                <p className="font-semibold">تعذّر تحديث {ordersError && trackingError ? 'الطلبات والتتبع' : ordersError ? 'الطلبات' : 'التتبع'}.</p>
                <p>{unavailable ? 'البيانات غير متاحة بعد. أعد المحاولة من زر التحديث.' : 'نعرض آخر بيانات مقروءة بنجاح؛ قد تكون قديمة.'}</p>
              </div>
            )}
            {sync.data[0]?.generation === 'demo-synthetic' && <p role="status" className="mb-4 rounded bg-amber-100 p-3 text-amber-950">نسخة اختبار — بيانات اصطناعية وليست طلبات المتجر</p>}
            {!unavailable && <Suspense fallback={<p role="status">جاري فتح الصفحة...</p>}><Routes>
              <Route path="/" element={<ProtectedRoute><Dashboard orders={orders} trackingOrders={trackingOrders} /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><Products trackingOrders={trackingOrders} /></ProtectedRoute>} />
              <Route path="/agents" element={<ProtectedRoute><Agents orders={orders} trackingOrders={trackingOrders} /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><Orders orders={orders} /></ProtectedRoute>} />
              <Route path="/tracking" element={<ProtectedRoute><Tracking trackingOrders={trackingOrders} /></ProtectedRoute>} />
              <Route path="/risk" element={<ProtectedRoute><RiskCenter trackingOrders={trackingOrders} /></ProtectedRoute>} />
              <Route path="/monthly-report" element={<ProtectedRoute><MonthlyReport trackingOrders={trackingOrders} /></ProtectedRoute>} />
              <Route path="/yearly-report" element={<ProtectedRoute><YearlyReport trackingOrders={trackingOrders} /></ProtectedRoute>} />
              <Route path="/product-analysis" element={<ProtectedRoute><ProductAnalysis trackingOrders={trackingOrders} /></ProtectedRoute>} />
              <Route path="/daily-trends" element={<ProtectedRoute><DailyTrends trackingOrders={trackingOrders} /></ProtectedRoute>} />
              <Route path="/risk-dashboard" element={<ProtectedRoute><RiskDashboard trackingOrders={trackingOrders} /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes></Suspense>}
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
