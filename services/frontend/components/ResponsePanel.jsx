import { useEffect, useState } from 'react';

import { getResponses } from '../services/api';

import { Badge } from '../ui';

function pillTone(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'executed') return 'success';
  if (s === 'failed') return 'critical';
  if (s === 'skipped') return 'neutral';
  return 'neutral';
}

function fmtTime(v) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ResponsePanel({ token, anomalyId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!anomalyId) return undefined;

    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError('');
        const json = await getResponses(anomalyId, { token, signal: controller.signal });
        setItems(Array.isArray(json.items) ? json.items : Array.isArray(json) ? json : []);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setError(e?.message || 'Failed to load responses');
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [token, anomalyId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-soc-border bg-black/10">
      <div className="border-b border-soc-border px-4 py-3">
        <div className="text-sm font-semibold text-soc-text">Response Panel</div>
        <div className="mt-0.5 text-[11px] text-soc-muted">BLOCK_IP, RATE_LIMIT_IP, etc.</div>
      </div>

      {loading ? <div className="px-4 py-4 text-sm text-soc-muted">Loading responses…</div> : null}
      {error ? <div className="px-4 py-3 text-sm text-soc-critical">{error}</div> : null}

      <div className="divide-y divide-soc-border">
        {items.length ? (
          items.map((r) => (
            <div key={r?._id || `${r?.action}-${r?.target}-${r?.createdAt}`} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-soc-text">{r?.action || 'ACTION'}</div>
                  <div className="mt-1 text-xs text-soc-muted">
                    {r?.target ? `Target: ${r.target}` : 'Target: -'}
                    <span className="mx-2 text-soc-border">•</span>
                    {fmtTime(r?.createdAt)}
                  </div>
                </div>

                <Badge tone={pillTone(r?.status)} className="shrink-0">
                  {String(r?.status || 'unknown').toUpperCase()}
                </Badge>
              </div>

              {r?.message ? <div className="mt-2 text-xs text-soc-muted">{r.message}</div> : null}
            </div>
          ))
        ) : !loading ? (
          <div className="px-4 py-6 text-sm text-soc-muted">No responses recorded for this anomaly.</div>
        ) : null}
      </div>
    </div>
  );
}
