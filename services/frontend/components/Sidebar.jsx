import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/router';
import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Zap,
} from 'lucide-react';
import { useMemo } from 'react';

import { Button, Card } from '../ui';

function classNames(...xs) {
  return xs.filter(Boolean).join(' ');
}

function navItemTone(isActive) {
  if (isActive) {
    return 'bg-white/6 text-soc-text ring-1 ring-inset ring-soc-border';
  }
  return 'text-soc-muted hover:text-soc-text hover:bg-white/4';
}

export default function Sidebar({ collapsed, onToggle }) {
  const router = useRouter();

  const items = useMemo(
    () => [
      { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
      { label: 'Alerts', href: '/alerts', Icon: Bell },
      { label: 'Anomalies', href: '/anomalies', Icon: Activity },
      { label: 'Incidents', href: '/incidents', Icon: Siren },
      { label: 'Logs', href: '/logs', Icon: ScrollText },
      { label: 'Responses', href: '/responses', Icon: Zap },
      { label: 'System Health', href: '/system-health', Icon: ShieldCheck },
    ],
    []
  );

  const activePath = String(router.asPath || '').split('?')[0].split('#')[0];

  function navigate(href) {
    if (!href) return;
    if (router.asPath === href) return;
    router.push(href);
  }

  return (
    <motion.aside
      className={classNames(
        'sticky top-0 h-screen shrink-0 border-r border-soc-border bg-soc-bg/60 backdrop-blur',
        'supports-[backdrop-filter]:bg-soc-bg/40'
      )}
      animate={{ width: collapsed ? 76 : 280 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="flex h-full flex-col">
        <div className={classNames('flex items-center justify-between gap-2 px-4 py-4', collapsed ? 'px-3' : 'px-4')}>
          <button type="button" onClick={() => navigate('/dashboard')} className="group flex items-center gap-3" aria-label="Go to dashboard">
            <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-soc-border bg-soc-card shadow-card">
              <div className="absolute inset-0 bg-gradient-to-br from-soc-info/35 via-transparent to-soc-success/20" />
              <ShieldAlert className="relative h-5 w-5 text-soc-text" />
            </div>
            <AnimatePresence initial={false}>
              {!collapsed ? (
                <motion.div
                  key="brand"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                  className="min-w-0"
                >
                  <div className="truncate text-sm font-semibold text-soc-text">SentinelAI</div>
                  <div className="truncate text-[11px] text-soc-muted">SOC Console</div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className={classNames('h-9 w-9 p-0', collapsed ? 'rounded-card' : 'rounded-control')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <div className="px-3">
          <div className="h-px w-full bg-soc-border" />
        </div>

        <nav className={classNames('mt-3 flex-1 space-y-1 px-2', collapsed ? 'px-2' : 'px-3')} aria-label="Primary">
          {items.map(({ label, href, Icon }) => {
            const isActive = activePath === href || activePath.startsWith(`${href}/`);
            return (
              <button
                key={href}
                type="button"
                className={classNames(
                  'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
                  navItemTone(isActive)
                )}
                onClick={() => navigate(href)}
                title={label}
              >
                <div className={classNames('grid h-9 w-9 place-items-center rounded-2xl border border-soc-border bg-black/10', isActive ? 'bg-white/6' : '')}>
                  <Icon className={classNames('h-4 w-4', isActive ? 'text-soc-text' : 'text-soc-muted group-hover:text-soc-text')} />
                </div>
                <AnimatePresence initial={false}>
                  {!collapsed ? (
                    <motion.span
                      key="label"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.14 }}
                      className="truncate"
                    >
                      {label}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        <div className={classNames('px-3 pb-4', collapsed ? 'px-2' : 'px-3')}>
          <Card className="bg-black/10 shadow-none" padding="md">
            <div className={classNames('flex items-center gap-3', collapsed ? 'justify-center' : '')}>
              <div className="grid h-9 w-9 place-items-center rounded-2xl border border-soc-border bg-black/10">
                <ShieldAlert className="h-4 w-4 text-soc-muted" />
              </div>
              <AnimatePresence initial={false}>
                {!collapsed ? (
                  <motion.div
                    key="foot"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.14 }}
                    className="min-w-0"
                  >
                    <div className="text-xs font-semibold text-soc-text">Threat posture</div>
                    <div className="mt-0.5 text-[11px] text-soc-muted">Realtime visibility</div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </Card>
        </div>
      </div>
    </motion.aside>
  );
}
