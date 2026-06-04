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
import { RiskCenter } from '@/pages/RiskCenter';
import { MonthlyReport } from '@/pages/MonthlyReport';
import { useSheetData } from '@/hooks/useSheetData';
import { isAuthenticated, logout } from '@/lib/auth';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-bg)]">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--color-primary)] mx-auto" />
          <p className="text-sm text-[var(--color-text-muted)]">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-bg)]">
        <div className="text-center space-y-4">
          <p className="text-[var(--color-danger)] text-lg">{error}</p>
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
          className="flex-1 flex flex-col transition-all duration-300"
          style={{ marginRight: sidebarCollapsed ? '4rem' : '16rem' }}
        >
          <TopBar
            dark={dark}
            onToggleDark={() => setDark(d => !d)}
            lastUpdated={lastUpdated}
            onRefresh={refresh}
            loading={loading}
          />
          <main className="flex-1 p-6 overflow-auto">
            <Routes>
              <Route path="/" element={<ProtectedRoute><Dashboard orders={orders} /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><Products orders={orders} /></ProtectedRoute>} />
              <Route path="/agents" element={<ProtectedRoute><Agents orders={orders} /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><Orders orders={orders} /></ProtectedRoute>} />
              <Route path="/risk" element={<ProtectedRoute><RiskCenter orders={orders} /></ProtectedRoute>} />
              <Route path="/monthly-report" element={<ProtectedRoute><MonthlyReport orders={orders} /></ProtectedRoute>} />
              <Route path="/login" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
