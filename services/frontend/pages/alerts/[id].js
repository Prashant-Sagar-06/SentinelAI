import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { ChevronLeft } from 'lucide-react';

import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import useAuth from '../../hooks/useAuth';
import { Button, ButtonLink, Card, CardHeader, Input, SeverityBadge, Table, TBody, TD, TH, THead, TR } from '../../ui';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not defined');
}

export default function AlertDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { token } = useAuth();
  const [alert, setAlert] = useState(null);
  const [relatedLogs, setRelatedLogs] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [assignTo, setAssignTo] = useState('');

  async function loadAlert(nextToken) {
    if (!id || !nextToken) return;

    const res = await fetch(`${API_BASE}/api/alerts/${id}`, {
      headers: { authorization: `Bearer ${nextToken}` },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => 'Failed to load alert');
      throw new Error(txt);
    }

    const json = await res.json().catch(() => ({}));
    const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
    setAlert(data.alert);
    setRelatedLogs(Array.isArray(data.related_logs) ? data.related_logs : []);
    setAiAnalysis(data.ai_analysis || null);
  }

  useEffect(() => {
    if (!id || !token) return;
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        await loadAlert(token);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load alert');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function refresh() {
    if (!token) return;
    try {
      await loadAlert(token);
    } catch {
      // best-effort
    }
  }

  async function action(path, body) {
    if (!token) return;

    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/api/alerts/${id}/${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const json = await res.json().catch(() => ({}));
      const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
      if (!res.ok) throw new Error(json?.error || (await res.text().catch(() => 'Action failed')));
      if (data?.alert) setAlert(data.alert);
      await refresh();
      toast.success('Action completed');
    } catch (e) {
      const msg = e?.message || 'Action failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  }

  const timeline = useMemo(() => {
    const buckets = new Map();
    for (const ev of relatedLogs) {
      const t = new Date(ev?.timestamp);
      if (Number.isNaN(t.getTime())) continue;
      const key = t.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return [...buckets.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([k, count]) => {
        const dt = new Date(k);
        return {
          time: Number.isNaN(dt.getTime()) ? k : dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
          events: count,
        };
      });
  }, [relatedLogs]);

  function TooltipContent({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="rounded-xl border border-soc-border bg-soc-bg/90 px-3 py-2 text-xs text-soc-text shadow-card">
        <div className="text-soc-muted">{label}</div>
        <div className="mt-1 flex items-center justify-between gap-6">
          <span className="text-soc-muted">Events</span>
          <span className="font-semibold text-soc-text">{payload[0]?.value ?? 0}</span>
        </div>
      </div>
    );
  }

  const createdAt = useMemo(() => {
    const v = alert?.createdAt || alert?.first_seen || alert?.window_start;
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }, [alert?.createdAt, alert?.first_seen, alert?.window_start]);

  return (
    <ProtectedRoute>
      <Layout
      title="Alert Investigation"
      subtitle={
        alert
          ? `${String(alert?.severity || 'unknown').toUpperCase()} · ${alert?.status || 'Unknown'}${createdAt ? ` · ${createdAt.toLocaleString()}` : ''}`
          : 'Loading investigation context'
      }
      onRefresh={refresh}
      refreshing={!alert && !error}
      rightSlot={
        <ButtonLink href="/alerts" variant="ghost" size="sm">
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </ButtonLink>
      }
    >
      {error ? <Card className="mb-4 border-soc-critical/35 bg-soc-critical/10 text-ui-sm text-soc-text">{error}</Card> : null}

      {!alert ? (
        <Card className="text-ui-sm text-soc-muted">Loading alert…</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-soc-muted">Alert</div>
                  <div className="mt-1 truncate text-lg font-semibold text-soc-text">{alert?.title || 'Alert'}</div>
                </div>
                <SeverityBadge severity={alert?.severity} />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-control border border-soc-border bg-black/10 px-3 py-2">
                  <div className="text-xs text-soc-muted">Status</div>
                  <div className="mt-0.5 text-sm text-soc-text">{alert?.status || '-'}</div>
                </div>
                <div className="rounded-control border border-soc-border bg-black/10 px-3 py-2">
                  <div className="text-xs text-soc-muted">Threat Type</div>
                  <div className="mt-0.5 text-sm text-soc-text">{alert?.threat_type || '-'}</div>
                </div>
                <div className="rounded-control border border-soc-border bg-black/10 px-3 py-2">
                  <div className="text-xs text-soc-muted">Source IP</div>
                  <div className="mt-0.5 text-sm font-mono text-soc-text">{alert?.source_ip || '-'}</div>
                </div>
                <div className="rounded-control border border-soc-border bg-black/10 px-3 py-2">
                  <div className="text-xs text-soc-muted">Actor</div>
                  <div className="mt-0.5 text-sm text-soc-text">{alert?.actor || '-'}</div>
                </div>
              </div>

              <div className="mt-3 rounded-control border border-soc-border bg-black/10 px-3 py-2">
                <div className="text-xs text-soc-muted">Reason</div>
                <div className="mt-0.5 text-sm text-soc-text">{alert?.reason || '-'}</div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Actions" subtitle="Triage & assignment" />

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => action('ack')}
                  disabled={actionLoading}
                  loading={actionLoading}
                >
                  ACK
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => action('close')}
                  disabled={actionLoading}
                  loading={actionLoading}
                >
                  Resolve
                </Button>
              </div>

              <div className="mt-3 grid gap-2">
                <Input
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  placeholder={alert?.assigned_to ? `Assigned to: ${alert.assigned_to}` : 'Assign to (email or name)'}
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => action('assign', { assigned_to: assignTo.trim() || null })}
                  disabled={actionLoading}
                  loading={actionLoading}
                >
                  Assign
                </Button>
              </div>

              <div className="mt-3 text-xs text-soc-muted">
                Current: <span className="text-soc-text">{alert?.assigned_to || 'Unassigned'}</span>
              </div>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="AI Analysis" subtitle="Anomaly explanations" />

              {aiAnalysis && Array.isArray(aiAnalysis.explanations) && aiAnalysis.explanations.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-soc-text">
                  {aiAnalysis.explanations.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-soc-muted">No AI explanations available for this alert.</div>
              )}
            </Card>

            <Card>
              <CardHeader title="Timeline" subtitle="Related events over time" />

              <div className="h-56">
                {timeline.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                      <defs>
                        <linearGradient id="eventsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: 'rgba(229,231,235,0.75)', fontSize: 12 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: 'rgba(229,231,235,0.75)', fontSize: 12 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<TooltipContent />} />
                      <Area type="monotone" dataKey="events" stroke="#F59E0B" fill="url(#eventsFill)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-soc-muted">No related events yet.</div>
                )}
              </div>
            </Card>
          </div>

          <Card className="mt-6 overflow-hidden p-0">
            <div className="border-b border-soc-border px-4 py-3">
              <CardHeader title="Related Logs" subtitle="Last 20 matching source_ip or actor" className="mb-0" />
            </div>

            <Table minWidth={860}>
              <THead>
                <tr>
                  <TH>Timestamp</TH>
                  <TH>Event Type</TH>
                  <TH>Message</TH>
                </tr>
              </THead>
              <TBody>
                {relatedLogs.length ? (
                  relatedLogs.map((ev) => (
                    <TR key={ev._id}>
                      <TD>{ev?.timestamp ? new Date(ev.timestamp).toLocaleString() : '-'}</TD>
                      <TD className="font-mono">{ev?.event_type || '-'}</TD>
                      <TD>{ev?.message || '-'}</TD>
                    </TR>
                  ))
                ) : (
                  <tr>
                    <TD className="py-6 text-soc-muted" colSpan={3}>
                      No related logs.
                    </TD>
                  </tr>
                )}
              </TBody>
            </Table>
          </Card>
        </>
      )}
      </Layout>
    </ProtectedRoute>
  );
}
