import { cn } from './cn';

const TONES = {
  critical: 'bg-soc-critical/10 text-soc-critical ring-soc-critical/25',
  warning: 'bg-soc-warning/10 text-soc-warning ring-soc-warning/25',
  info: 'bg-soc-info/10 text-soc-info ring-soc-info/25',
  success: 'bg-soc-success/10 text-soc-success ring-soc-success/25',
  neutral: 'bg-white/6 text-soc-text ring-white/10',
};

export function Badge({ className, tone = 'neutral', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-ui-xs font-semibold ring-1 ring-inset',
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  const s = String(severity ?? '').toLowerCase();
  const tone =
    s === 'critical' || s === 'high'
      ? 'critical'
      : s === 'medium' || s === 'warning'
        ? 'warning'
        : s === 'low' || s === 'normal'
          ? 'success'
          : 'neutral';
  const label = s ? s.toUpperCase() : 'UNKNOWN';
  return <Badge tone={tone}>{label}</Badge>;
}
