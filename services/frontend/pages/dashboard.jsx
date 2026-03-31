import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Gauge, Globe2, ShieldAlert, Timer } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import AnomalyDetailModal from '../components/AnomalyDetailModal';
import AnomalyList from '../components/AnomalyList';
import AttackMap from '../components/AttackMap';
import Charts from '../components/Charts';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import MetricCard from '../components/MetricCard';
import useAuth from '../hooks/useAuth';
import { Badge, Button, Card, CardHeader, Modal as UiModal, ModalPanel, Table, TBody, TD, TH, THead, TR } from '../ui';

const PerfCharts = dynamic(() => import('../components/PerfCharts'), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center rounded-2xl border border-soc-border bg-black/10 text-xs text-soc-muted">
      Loading charts…
    </div>
  ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not defined');
}

function startOfLocalDayIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return start.toISOString();
}

function endOfLocalDayIso() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return end.toISOString();
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatCompact(n) {
  if (n == null || Number.isNaN(Number(n))) return '-';
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(Number(n));
}

function Panel({ title, right, children }) {
  return (
    <Card>
      <CardHeader title={title} right={right ? <span className="text-ui-xs text-soc-muted">{right}</span> : null} />
      {children}
    </Card>
  );
}

function HealthRow({ name, status = 'Unknown' }) {
  const tone = status === 'OK' ? 'success' : status === 'Down' ? 'critical' : 'neutral';

  return (
    <div className="flex items-center justify-between rounded-control border border-soc-border bg-black/10 px-3 py-2">
      <div className="text-ui-base text-soc-text">{name}</div>
      <Badge tone={tone}>{status}</Badge>
    </div>
  );
}

function TooltipContent({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-soc-border bg-soc-bg/90 px-3 py-2 text-xs text-soc-text shadow-card">
      <div className="text-soc-muted">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-6">
        <span className="text-soc-muted">Alerts</span>
        <span className="font-semibold text-soc-text">{payload[0]?.value ?? 0}</span>
      </div>
    </div>
  );
}

function CopilotModal({ open, title, onClose, children }) {
  return (
    <UiModal open={open} onClose={onClose}>
      <ModalPanel className="mt-24 w-[min(780px,calc(100%-2rem))]">
        <Card padding="lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-ui-xs font-semibold text-soc-muted">SentinelAI Copilot</div>
              <div className="mt-1 text-lg font-semibold text-soc-text">{title}</div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>

          <div className="mt-4">{children}</div>
        </Card>
      </ModalPanel>
    </UiModal>
  );
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [logsTodayTotal, setLogsTodayTotal] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState(null);

  const [systemHealth, setSystemHealth] = useState(null);
  const [healthError, setHealthError] = useState('');
  const [healthRefreshedAt, setHealthRefreshedAt] = useState(null);

  const [perfMetrics, setPerfMetrics] = useState(null);
  const [perfSeries, setPerfSeries] = useState([]);
  const [perfError, setPerfError] = useState('');
  const [perfRefreshedAt, setPerfRefreshedAt] = useState(null);

  const [anomalies, setAnomalies] = useState([]);
  const [anomaliesLoading, setAnomaliesLoading] = useState(false);
  const [anomaliesError, setAnomaliesError] = useState('');
  const [anomaliesRefreshedAt, setAnomaliesRefreshedAt] = useState(null);

  const [selectedAnomalyId, setSelectedAnomalyId] = useState('');

  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState('');
  const [copilotAlert, setCopilotAlert] = useState(null);
  const [copilotResult, setCopilotResult] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    let interval;

    async function loadHealth() {
      try {
        setHealthError('');
        const res = await fetch(`${API_BASE}/api/system-health`, {
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${token}`,
            accept: 'application/json',
          },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to load system health');
        const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
        setSystemHealth(data);
        setHealthRefreshedAt(new Date());
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setHealthError(e?.message || 'Failed to load system health');
        setSystemHealth(null);
      }
    }

    loadHealth();
    interval = setInterval(loadHealth, 10_000);

    return () => {
      controller.abort();
      if (interval) clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    let interval;

    async function loadPerf() {
      try {
        setPerfError('');
        const res = await fetch(`${API_BASE}/api/metrics/summary`, {
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${token}`,
            accept: 'application/json',
          },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to load performance metrics');
        const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
        setPerfMetrics(data);
        setPerfSeries((prev) => {
          const now = new Date();
          const point = {
            time: now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            requests_per_minute: Number(data?.requests_per_minute ?? 0),
            error_rate: Number(data?.error_rate ?? 0),
            avg_latency_ms: Number(data?.avg_latency_ms ?? 0),
          };

          const next = [...(Array.isArray(prev) ? prev : []), point];
          return next.slice(Math.max(0, next.length - 30));
        });
        setPerfRefreshedAt(new Date());
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setPerfError(e?.message || 'Failed to load performance metrics');
        setPerfMetrics(null);
      }
    }

    loadPerf();
    interval = setInterval(loadPerf, 10_000);

    return () => {
      controller.abort();
      if (interval) clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    let interval;

    async function loadAnomalies() {
      try {
        setAnomaliesLoading(true);
        setAnomaliesError('');
        const res = await fetch(`${API_BASE}/api/anomalies?limit=20`, {
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${token}`,
            accept: 'application/json',
          },
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to load anomalies');
        const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
        setAnomalies(Array.isArray(data.items) ? data.items : []);
        setAnomaliesRefreshedAt(new Date());
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setAnomaliesError(e?.message || 'Failed to load anomalies');
        setAnomalies([]);
      } finally {
        setAnomaliesLoading(false);
      }
    }

    loadAnomalies();
    interval = setInterval(loadAnomalies, 10_000);

    return () => {
      controller.abort();
      if (interval) clearInterval(interval);
    };
  }, [token]);

  function formatPercent(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '-';
    return `${(n * 100).toFixed(1)}%`;
  }

  function formatMs(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '-';
    return `${Math.round(n)} ms`;
  }

  function healthStatusLabel(v) {
    const s = String(v ?? '').toLowerCase();
    if (s === 'ok' || s === 'true') return 'OK';
    if (s === 'down' || s === 'false') return 'Down';
    return 'Unknown';
  }

  async function loadAll(currentToken) {
    setLoading(true);
    setError('');

    try {
      const start = startOfLocalDayIso();
      const end = endOfLocalDayIso();

      const [alertsRes, incidentsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/api/alerts?limit=200`, { headers: { authorization: `Bearer ${currentToken}` } }),
        fetch(`${API_BASE}/api/incidents?limit=100`, { headers: { authorization: `Bearer ${currentToken}` } }),
        fetch(`${API_BASE}/api/logs?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}&limit=1`, {
          headers: { authorization: `Bearer ${currentToken}` },
        }),
      ]);

      const [alertsJson, incidentsJson, logsJson] = await Promise.all([
        alertsRes.json().catch(() => ({})),
        incidentsRes.json().catch(() => ({})),
        logsRes.json().catch(() => ({})),
      ]);

      if (!alertsRes.ok) throw new Error(alertsJson?.error || 'Failed to load alerts');
      if (!incidentsRes.ok) throw new Error(incidentsJson?.error || 'Failed to load incidents');
      if (!logsRes.ok) throw new Error(logsJson?.error || 'Failed to load logs');

      const alertsData = alertsJson && typeof alertsJson === 'object' && 'data' in alertsJson ? alertsJson.data : alertsJson;
      const incidentsData = incidentsJson && typeof incidentsJson === 'object' && 'data' in incidentsJson ? incidentsJson.data : incidentsJson;
      const logsData = logsJson && typeof logsJson === 'object' && 'data' in logsJson ? logsJson.data : logsJson;

      setAlerts(Array.isArray(alertsData.items) ? alertsData.items : []);
      setIncidents(Array.isArray(incidentsData.incidents) ? incidentsData.incidents : []);
      setLogsTodayTotal(Number(logsData.total ?? 0));
      setRefreshedAt(new Date());
    } catch (e) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadAll(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io(API_BASE, { auth: { token } });

    socket.on('alert_created', () => {
      loadAll(token);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  async function analyzeAlert(a) {
    if (!a?._id) return;
    if (!token) return;

    try {
      setCopilotAlert(a);
      setCopilotOpen(true);
      setCopilotLoading(true);
      setCopilotError('');
      setCopilotResult(null);

      const res = await fetch(`${API_BASE}/api/copilot/analyze`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ alertId: a._id }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to analyze alert');
      const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
      setCopilotResult(data);
    } catch (e) {
      setCopilotError(e?.message || 'Failed to analyze alert');
    } finally {
      setCopilotLoading(false);
    }
  }

  const series = useMemo(() => {
    const now = new Date();
    const windowHours = 24;
    const start = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

    const buckets = [];
    for (let i = windowHours - 1; i >= 0; i -= 1) {
      const t = new Date(now.getTime() - i * 60 * 60 * 1000);
      buckets.push({
        label: t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        alerts: 0,
        startMs: new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), 0, 0, 0).getTime(),
        endMs: new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), 59, 59, 999).getTime(),
      });
    }

    for (const a of alerts) {
      const dt = toDate(a?.createdAt) || toDate(a?.first_seen) || toDate(a?.window_start);
      if (!dt) continue;
      if (dt < start) continue;
      const ms = dt.getTime();
      const b = buckets.find((x) => ms >= x.startMs && ms <= x.endMs);
      if (b) b.alerts += 1;
    }

    return buckets.map((b) => ({ time: b.label, alerts: b.alerts }));
  }, [alerts]);

  const uniqueIps = useMemo(() => {
    if (Array.isArray(perfMetrics?.top_ips)) return perfMetrics.top_ips.length;
    return 0;
  }, [perfMetrics?.top_ips]);

  return (
    <ProtectedRoute>
      <Layout
        title="Security Operations Dashboard"
        subtitle={refreshedAt ? `Last refresh ${refreshedAt.toLocaleTimeString()}` : 'Realtime telemetry + AI copilot'}
        onRefresh={() => loadAll(token)}
        refreshing={loading}
      >
        {error ? (
          <Card className="mb-4 border-soc-critical/30 bg-soc-critical/10" padding="md">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-soc-critical" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-soc-text">Dashboard error</div>
                <div className="mt-1 text-xs text-soc-muted">{error}</div>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Requests / min"
            value={formatCompact(perfMetrics?.requests_per_minute)}
            subtitle="Last 60s"
            Icon={Gauge}
            tone="info"
          />
          <MetricCard
            title="Error Rate"
            value={formatPercent(perfMetrics?.error_rate)}
            subtitle="Status = error"
            Icon={ShieldAlert}
            tone={Number(perfMetrics?.error_rate ?? 0) > 0.2 ? 'critical' : 'neutral'}
          />
          <MetricCard
            title="Avg Latency"
            value={formatMs(perfMetrics?.avg_latency_ms)}
            subtitle="Mean latency"
            Icon={Timer}
            tone={Number(perfMetrics?.avg_latency_ms ?? 0) > 1200 ? 'warning' : 'success'}
          />
          <MetricCard
            title="Unique IPs"
            value={formatCompact(uniqueIps)}
            subtitle="Active in last 60s"
            Icon={Globe2}
            tone={uniqueIps > 20 ? 'warning' : 'neutral'}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="Requests Overview" right="Last 24 hours">
            <div className="h-64">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="alertsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1F2937" strokeDasharray="4 6" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      axisLine={{ stroke: '#1F2937' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      axisLine={{ stroke: '#1F2937' }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<TooltipContent />} />
                    <Area type="monotone" dataKey="alerts" stroke="#3B82F6" fill="url(#alertsFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-soc-muted">Loading chart…</div>
              )}
            </div>
          </Panel>

          <Panel title="Attack Map" right="Top 50 IPs">
            <AttackMap token={token} />
          </Panel>
        </div>

        <div className="mt-6">
          <Panel title="Charts" right={perfRefreshedAt ? `Updated ${perfRefreshedAt.toLocaleTimeString()}` : 'Polling /api/metrics/summary'}>
            <Charts series={perfSeries} />
            <div className="mt-4">
              <PerfCharts series={perfSeries} topIps={perfMetrics?.top_ips} />
            </div>
            {perfError ? <div className="mt-3 text-xs text-soc-critical">{perfError}</div> : null}
          </Panel>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Panel title="Anomaly Panel" right={anomaliesRefreshedAt ? `Updated ${anomaliesRefreshedAt.toLocaleTimeString()}` : ''}>
              <AnomalyList
                anomalies={anomalies}
                loading={anomaliesLoading}
                error={anomaliesError}
                selectedId={selectedAnomalyId}
                onSelect={(a) => {
                  if (!a?._id) return;
                  setSelectedAnomalyId(String(a._id));
                }}
              />
            </Panel>
          </div>

          <Panel title="System Health" right={healthRefreshedAt ? `Updated ${healthRefreshedAt.toLocaleTimeString()}` : ''}>
            <div className="grid gap-2">
              <HealthRow name="Backend" status={healthStatusLabel(systemHealth?.backend?.status)} />
              <HealthRow name="Worker" status={healthStatusLabel(systemHealth?.worker?.status)} />
              <HealthRow name="MongoDB" status={healthStatusLabel(systemHealth?.mongo?.status)} />
              <HealthRow name="Redis" status={healthStatusLabel(systemHealth?.redis?.status)} />
              <HealthRow name="AI Engine" status={healthStatusLabel(systemHealth?.ai_engine?.status)} />
            </div>
            {healthError ? <div className="mt-3 text-xs text-soc-critical">{healthError}</div> : null}
          </Panel>
        </div>

        <div className="mt-6">
          <Panel title="Recent Alerts" right="Realtime via Socket.IO">
            <div className="overflow-hidden rounded-card border border-soc-border">
              <Table minWidth={720}>
                <THead>
                  <tr>
                    <TH>Title</TH>
                    <TH>Severity</TH>
                    <TH>Type</TH>
                    <TH>Created</TH>
                    <TH />
                  </tr>
                </THead>
                <TBody>
                  {alerts?.length ? (
                    alerts.slice(0, 10).map((a) => (
                      <TR key={a._id}>
                        <TD>{a.title}</TD>
                        <TD>{a.severity}</TD>
                        <TD className="text-soc-muted">{a.type || a.threat_type}</TD>
                        <TD className="text-soc-muted">{toDate(a.createdAt)?.toLocaleTimeString?.() || '-'}</TD>
                        <TD className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => analyzeAlert(a)}
                            disabled={!token || copilotLoading}
                            loading={Boolean(copilotLoading && copilotAlert?._id === a._id)}
                          >
                            Analyze
                          </Button>
                        </TD>
                      </TR>
                    ))
                  ) : (
                    <tr>
                      <TD className="py-6 text-soc-muted" colSpan={5}>
                        No alerts yet.
                      </TD>
                    </tr>
                  )}
                </TBody>
              </Table>
            </div>
          </Panel>
        </div>

        <div className="mt-8 border-t border-soc-border pt-4 text-xs text-soc-muted">
          {refreshedAt ? `Last refresh: ${refreshedAt.toLocaleString()}` : ''}
        </div>

        <CopilotModal
          open={copilotOpen}
          title={copilotAlert?.title ? `Analyze: ${copilotAlert.title}` : 'Analyze Alert'}
          onClose={() => {
            setCopilotOpen(false);
            setCopilotError('');
            setCopilotResult(null);
            setCopilotAlert(null);
          }}
        >
          {copilotLoading ? (
            <Card className="bg-black/10 shadow-none text-ui-base text-soc-muted" padding="md">
              Analyzing…
            </Card>
          ) : null}

          {copilotError ? (
            <Card className="mt-3 border-soc-critical/35 bg-soc-critical/10 text-ui-base text-soc-text" padding="md">
              {copilotError}
            </Card>
          ) : null}

          {copilotResult && !copilotLoading ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {copilotResult.risk_level ? <Badge tone="neutral">Risk: {String(copilotResult.risk_level).toUpperCase()}</Badge> : null}
                {copilotResult.threat_intel?.risk_level ? (
                  <Badge tone="success">Threat Intel: {String(copilotResult.threat_intel.risk_level).toUpperCase()}</Badge>
                ) : null}
              </div>

              <Card className="bg-black/10 shadow-none" padding="md">
                <div className="text-xs font-semibold text-soc-muted">Summary</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-soc-text">{copilotResult.analysis}</div>
              </Card>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="bg-black/10 shadow-none" padding="md">
                  <div className="text-xs font-semibold text-soc-muted">Evidence</div>
                  {Array.isArray(copilotResult.evidence) && copilotResult.evidence.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-soc-text">
                      {copilotResult.evidence.map((e, idx) => (
                        <li key={idx}>{e}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-sm text-soc-muted">No evidence returned.</div>
                  )}
                </Card>

                <Card className="bg-black/10 shadow-none" padding="md">
                  <div className="text-xs font-semibold text-soc-muted">Recommended Actions</div>
                  {Array.isArray(copilotResult.recommended_actions) && copilotResult.recommended_actions.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-soc-text">
                      {copilotResult.recommended_actions.map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-sm text-soc-muted">No actions returned.</div>
                  )}
                </Card>
              </div>
            </div>
          ) : null}
        </CopilotModal>

        <AnomalyDetailModal
          token={token}
          anomalyId={selectedAnomalyId}
          open={Boolean(selectedAnomalyId)}
          onClose={() => setSelectedAnomalyId('')}
        />
      </Layout>
    </ProtectedRoute>
  );
}
