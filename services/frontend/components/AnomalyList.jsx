import { useMemo } from 'react';

import { SeverityBadge, Skeleton } from '../ui';

function classNames(...xs) {
  return xs.filter(Boolean).join(' ');
}

function fmtTime(v) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AnomalyList({ anomalies = [], selectedId, onSelect, loading, error }) {
  const items = useMemo(() => (Array.isArray(anomalies) ? anomalies : []), [anomalies]);

  return (
    <div className="overflow-hidden rounded-2xl border border-soc-border bg-black/10">
      <div className="flex items-center justify-between border-b border-soc-border px-4 py-3">
        <div className="text-sm font-semibold text-soc-text">Anomalies</div>
        <div className="text-[11px] text-soc-muted">Realtime (polling)</div>
      </div>

      {loading ? (
        <div className="px-4 py-4">
          <div className="grid gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ) : null}

      {error ? <div className="px-4 py-3 text-sm text-soc-critical">{error}</div> : null}

      <div className="divide-y divide-soc-border">
        {items.length ? (
          items.map((a) => {
            const isSelected = selectedId && String(a?._id) === String(selectedId);

            return (
              <button
                key={a?._id}
                type="button"
                className={classNames(
                  'w-full px-4 py-3 text-left transition-colors',
                  isSelected ? 'bg-white/6' : 'bg-transparent hover:bg-white/3'
                )}
                onClick={() => onSelect?.(a)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-soc-text">{a?.type || 'ANOMALY'}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-soc-muted">
                      <SeverityBadge severity={a?.severity} />
                      <span>score {typeof a?.score === 'number' ? a.score.toFixed(2) : '-'}</span>
                      <span className="text-soc-border">•</span>
                      <span>{fmtTime(a?.createdAt)}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-[11px] text-soc-muted">Open</div>
                </div>
              </button>
            );
          })
        ) : !loading ? (
          <div className="px-4 py-6 text-sm text-soc-muted">No anomalies yet.</div>
        ) : null}
      </div>
    </div>
  );
}
