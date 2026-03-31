import { Loader2 } from 'lucide-react';

import { cn } from './cn';

export function Spinner({ className, label }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-ui-sm text-soc-muted', className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-control bg-white/5', className)} />;
}

export function TableSkeleton({ rows = 8, cols = 6 }) {
  return (
    <tbody>
      {[...Array(rows)].map((_, r) => (
        <tr key={r} className="border-t border-soc-border">
          <td className="px-4 py-row" colSpan={cols}>
            <Skeleton className="h-5 w-full" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}
