import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/shared/Sidebar';
import { TopBar } from '@/components/shared/TopBar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Products } from '@/pages/Products';
import { Agents } from '@/pages/Agents';
import { Orders } from '@/pages/Orders';
import { Tracking } from '@/pages/Tracking';
import { RiskCenter } from '@/pages/RiskCenter';
import { MonthlyReport } from '@/pages/MonthlyReport';
import { YearlyReport } from '@/pages/YearlyReport';
import { ProductAnalysis } from '@/pages/ProductAnalysis';
import { DailyTrends } from '@/features/analytics/DailyTrends';
import { RiskDashboard } from '@/features/analytics/RiskDashboard';
import { NotificationSettings } from '@/features/analytics/NotificationSettings';
import { useSheetData } from '@/hooks/useSheetData';
import { useTrackingData } from '@/hooks/useTrackingData';
import { isAuthenticated, logout } from '@/lib/auth';
import { classNames } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
  };

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

  return <AuthenticatedApp sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} dark={dark} setDark={setDark} onLogout={handleLogout} />;
}

function AuthenticatedApp({ sidebarCollapsed, setSidebarCollapsed, dark, setDark, onLogout }: {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  dark: boolean;
  setDark: (v: boolean | ((prev: boolean) => boolean)) => void;
  onLogout: () => void;
}) {
  const { orders, loading, error, lastUpdated, refresh } = useSheetData();
  const { trackingOrders, trackingLoading, trackingError } = useTrackingData();

  console.log('[DZ-CHANGE] responsive-layout-loaded');
  console.log('[DZ-CHANGE] layout-desktop-fixed');
  console.log('[DZ-CHANGE] layout-mobile-fixed');

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

  if (error || trackingError) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-bg)]">
        <div className="text-center space-y-4">
          <p className="text-[var(--color-danger)] text-lg">{error || trackingError}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div dir="rtl" className="flex min-h-screen bg-[var(--color-bg)]">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} onLogout={onLogout} />
        <div
          className={classNames(
            'flex-1 flex flex-col min-w-0 overflow-x-hidden transition-all duration-300',
            sidebarCollapsed ? 'md:mr-16' : 'md:mr-64',
          )}
        >
          <TopBar
            dark={dark}
            onToggleDark={() => setDark(d => !d)}
            lastUpdated={lastUpdated}
            onRefresh={refresh}
            loading={loading}
            onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          />
          <main className="flex-1 p-6 overflow-x-hidden">
            <Routes>
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
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
