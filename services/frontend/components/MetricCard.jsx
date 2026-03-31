import { motion } from 'framer-motion';

import { Card } from '../ui';
import { cn } from '../ui/cn';

function toneStyles(tone) {
  const t = String(tone || 'neutral').toLowerCase();
  if (t === 'critical') return { ring: 'ring-soc-critical/25', icon: 'bg-soc-critical/12 text-soc-critical', bar: 'bg-soc-critical' };
  if (t === 'warning') return { ring: 'ring-soc-warning/25', icon: 'bg-soc-warning/12 text-soc-warning', bar: 'bg-soc-warning' };
  if (t === 'success') return { ring: 'ring-soc-success/25', icon: 'bg-soc-success/12 text-soc-success', bar: 'bg-soc-success' };
  if (t === 'info') return { ring: 'ring-soc-info/25', icon: 'bg-soc-info/12 text-soc-info', bar: 'bg-soc-info' };
  return { ring: 'ring-white/10', icon: 'bg-white/8 text-soc-text', bar: 'bg-white/30' };
}

export default function MetricCard({ title, value, subtitle, Icon, tone = 'neutral' }) {
  const styles = toneStyles(tone);

  return (
    <Card
      as={motion.div}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      interactive
      className={cn('ring-1 ring-inset', styles.ring)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-soc-muted">{title}</div>
          <div className="mt-2 truncate text-3xl font-semibold tracking-tight text-soc-text">{value}</div>
          {subtitle ? <div className="mt-1 text-[11px] text-soc-muted">{subtitle}</div> : null}
        </div>
        {Icon ? (
          <div className={cn('grid h-10 w-10 place-items-center rounded-2xl border border-soc-border', styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className={cn('h-full w-1/3 rounded-full', styles.bar)} />
      </div>
    </Card>
  );
}
