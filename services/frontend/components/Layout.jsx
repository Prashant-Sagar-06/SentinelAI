import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';

import Navbar from './Navbar';
import Sidebar from './Sidebar';
import useAuth from '../hooks/useAuth';
import { cn } from '../ui';

function defaultTitleForPath(pathname) {
  const p = String(pathname || '');
  if (p === '/dashboard') return 'Dashboard';
  if (p === '/alerts') return 'Alerts';
  if (p.startsWith('/alerts/')) return 'Alert Details';
  if (p === '/anomalies') return 'Anomalies';
  if (p === '/incidents') return 'Incidents';
  if (p.startsWith('/incidents/')) return 'Incident Details';
  if (p === '/responses') return 'Responses';
  if (p === '/system-health') return 'System Health';
  if (p === '/logs') return 'Logs';
  return 'SentinelAI';
}

export default function Layout({
  children,
  title,
  subtitle,
  rightSlot,
  onRefresh,
  refreshing,
  contentClassName,
}) {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const computedTitle = useMemo(() => {
    if (title) return title;
    return defaultTitleForPath(router.pathname);
  }, [title, router.pathname]);

  return (
    <div className="flex min-h-screen bg-soc-bg text-soc-text">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />

      <div className="min-w-0 flex-1">
        <Navbar
          title={computedTitle}
          subtitle={subtitle}
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          onLogout={handleLogout}
          onRefresh={onRefresh}
          refreshing={refreshing}
          rightSlot={rightSlot}
        />

        <main className={cn('mx-auto max-w-7xl px-4 py-6', contentClassName)}>{children}</main>
      </div>
    </div>
  );
}
