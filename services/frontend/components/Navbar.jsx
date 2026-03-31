import { motion } from 'framer-motion';
import { LogOut, Menu, RefreshCw } from 'lucide-react';

import { Button } from '../ui';

export default function Navbar({
  title,
  subtitle,
  onToggleSidebar,
  onLogout,
  onRefresh,
  refreshing,
  rightSlot,
}) {
  return (
    <div className="sticky top-0 z-30 border-b border-soc-border bg-soc-bg/60 backdrop-blur supports-[backdrop-filter]:bg-soc-bg/40">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-10 p-0"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-soc-text">{title}</div>
            {subtitle ? <div className="truncate text-[11px] text-soc-muted">{subtitle}</div> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rightSlot ? rightSlot : null}

          {onRefresh ? (
            <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
              <motion.span
                animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                transition={refreshing ? { repeat: Infinity, duration: 0.9, ease: 'linear' } : { duration: 0.2 }}
                className="inline-flex"
              >
                <RefreshCw className="h-4 w-4" />
              </motion.span>
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          ) : null}

          <Button type="button" variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
