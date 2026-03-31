import { useEffect, useMemo, useState } from 'react';

import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import useAuth from '../../hooks/useAuth';
import { Badge, Card, CardHeader, Skeleton } from '../../ui';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not defined');
}

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'ok') return 'success';
  if (s === 'down') return 'critical';
  return 'neutral';
}

export default function SystemHealthPage() {
  const { token } = useAuth();

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE}/api/system-health`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
      if (!res.ok) {
        const msg = (data && data?.error?.message) || (typeof data === 'string' ? data : 'Failed to load system health');
        throw new Error(msg);
      }
      setPayload(data);
    } catch (e) {
      setError(e?.message || 'Failed to load system health');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const checks = useMemo(() => {
    if (!payload) return [];
    const candidates = [
      { name: 'Backend', v: payload.backend },
      { name: 'MongoDB', v: payload.mongo },
      { name: 'Redis', v: payload.redis },
      { name: 'Worker', v: payload.worker },
      { name: 'AI Engine', v: payload.ai_engine },
    ];

    return candidates
      .filter((c) => c.v)
      .map((c) => ({
        name: c.name,
        status: c.v.status,
        latency_ms: c.v.latency_ms,
        timedOut: c.v.timedOut,
        error: c.v.error,
        extra: c.name === 'AI Engine' ? { urlConfigured: c.v.urlConfigured } : null,
      }));
  }, [payload]);

  return (
    <ProtectedRoute>
      <Layout title="System Health" subtitle="Backend dependencies & latency" onRefresh={load} refreshing={loading}>
      {error ? <Card className="mb-4 border-soc-critical/35 bg-soc-critical/10 text-ui-sm text-soc-text">{error}</Card> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Checks"
            subtitle={payload?.ts ? `Updated ${new Date(payload.ts).toLocaleString()}` : 'On-demand health probe'}
            right={<Badge tone={statusTone(payload?.ok ? 'ok' : 'down')}>{payload?.ok ? 'OK' : 'DEGRADED'}</Badge>}
          />

          <div className="mt-4 grid gap-2">
            {loading ? (
              [...Array(5)].map((_, idx) => <Skeleton key={idx} className="h-12 w-full" />)
            ) : checks.length ? (
              checks.map((c) => (
                <div key={c.name} className="flex items-center justify-between rounded-control border border-soc-border bg-black/10 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-soc-text">{c.name}</div>
                    <div className="mt-0.5 text-[11px] text-soc-muted">
                      {typeof c.latency_ms === 'number' ? `${c.latency_ms}ms` : '—'}
                      {c.timedOut ? ' · timeout' : ''}
                      {c.extra?.urlConfigured === false ? ' · url not configured' : ''}
                      {c.error ? ` · ${c.error}` : ''}
                    </div>
                  </div>
                  <Badge tone={statusTone(c.status)}>{String(c.status || 'unknown').toUpperCase()}</Badge>
                </div>
              ))
            ) : (
              <div className="text-sm text-soc-muted">No health payload.</div>
            )}
          </div>
        </Card>

        <Card>
          <div className="text-ui-base font-semibold text-soc-text">Notes</div>
          <div className="mt-2 text-sm text-soc-muted">This view reflects backend dependency checks (Mongo/Redis/Worker/AI Engine).</div>
          <div className="mt-3 rounded-control border border-soc-border bg-black/10 px-3 py-2 text-xs text-soc-muted">
            Use Refresh to re-run the health probe.
          </div>
        </Card>
      </div>
      </Layout>
    </ProtectedRoute>
  );
}
