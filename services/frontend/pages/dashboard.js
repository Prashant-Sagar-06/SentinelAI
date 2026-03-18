import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

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

function classNames(...xs) {
  return xs.filter(Boolean).join(' ');
}

function StatCard({ title, value, sub, tone = 'slate' }) {
  const toneMap = {
    slate: 'text-slate-200',
    red: 'text-red-200',
    amber: 'text-amber-200',
    emerald: 'text-emerald-200',
    cyan: 'text-cyan-200',
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-300">{title}</div>
        <div className="h-2 w-2 rounded-full bg-slate-600" />
      </div>
      <div className={classNames('mt-2 text-3xl font-semibold tracking-tight', toneMap[tone] || toneMap.slate)}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

function Panel({ title, right, children }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-slate-200">{title}</div>
        {right ? <div className="text-xs text-slate-400">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

function HealthRow({ name, status = 'Unknown' }) {
  const pill =
    status === 'OK'
      ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-500/20'
      : 'bg-slate-400/10 text-slate-200 ring-1 ring-slate-500/20';

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
      <div className="text-sm text-slate-200">{name}</div>
      <div className={classNames('rounded-full px-2.5 py-1 text-xs font-medium', pill)}>{status}</div>
    </div>
  );
}

function TooltipContent({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs text-slate-100 shadow-lg">
      <div className="text-slate-300">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-6">
        <span className="text-slate-300">Alerts</span>
        <span className="font-semibold text-slate-100">{payload[0]?.value ?? 0}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();

  const [token, setToken] = useState('');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [logsTodayTotal, setLogsTodayTotal] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState(null);

  const authHeader = useMemo(() => {
    if (!token) return {};
    return { authorization: `Bearer ${token}` };
  }, [token]);

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

      setAlerts(Array.isArray(alertsJson.items) ? alertsJson.items : []);
      setIncidents(Array.isArray(incidentsJson.incidents) ? incidentsJson.incidents : []);
      setLogsTodayTotal(Number(logsJson.total ?? 0));
      setRefreshedAt(new Date());
    } catch (e) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    const t = typeof window !== 'undefined' ? localStorage.getItem('sentinelai_token') : '';
    if (!t) {
      router.push('/login');
      return;
    }
    setToken(t);
    loadAll(t);
  }, [router]);

  const stats = useMemo(() => {
    const activeAlerts = alerts.filter((a) => String(a?.status ?? 'open') !== 'closed');
    const criticalAlerts = alerts.filter((a) => String(a?.severity ?? '').toLowerCase() === 'critical');
    const openIncidents = incidents.filter((i) => String(i?.status ?? 'open') !== 'resolved');

    return {
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      openIncidents: openIncidents.length,
      logsToday: logsTodayTotal,
    };
  }, [alerts, incidents, logsTodayTotal]);

  const topIps = useMemo(() => {
    const counts = new Map();
    for (const a of alerts) {
      const ip = a?.source_ip;
      if (!ip) continue;
      counts.set(ip, (counts.get(ip) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ip, count]) => ({ ip, count }));
  }, [alerts]);

  const series = useMemo(() => {
    const now = new Date();
    const windowHours = 24;
    const start = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

    const buckets = [];
    for (let i = windowHours - 1; i >= 0; i -= 1) {
      const t = new Date(now.getTime() - i * 60 * 60 * 1000);
      buckets.push({
        key: `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}-${t.getHours()}`,
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">SentinelAI</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Security Operations Dashboard</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden text-xs text-slate-400 sm:block">
              {refreshedAt ? `Updated ${refreshedAt.toLocaleTimeString()}` : ''}
            </div>
            <button
              type="button"
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900"
              onClick={() => loadAll(token)}
              disabled={!token || loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900/40"
              onClick={() => {
                localStorage.removeItem('sentinelai_token');
                router.push('/login');
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Active Alerts" value={formatCompact(stats.activeAlerts)} sub="Status ≠ closed" tone="cyan" />
          <StatCard title="Critical Alerts" value={formatCompact(stats.criticalAlerts)} sub="Severity = critical" tone="red" />
          <StatCard title="Open Incidents" value={formatCompact(stats.openIncidents)} sub="Status ≠ resolved" tone="amber" />
          <StatCard title="Logs Today" value={formatCompact(stats.logsToday)} sub="Local time window" tone="emerald" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Panel title="Alerts Over Time" right="Last 24 hours">
              <div className="h-64">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                      <defs>
                        <linearGradient id="alertsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1f2937" strokeDasharray="4 4" />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        axisLine={{ stroke: '#334155' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        axisLine={{ stroke: '#334155' }}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<TooltipContent />} />
                      <Area type="monotone" dataKey="alerts" stroke="#38bdf8" fill="url(#alertsFill)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">Loading chart…</div>
                )}
              </div>
            </Panel>
          </div>

          <div className="xl:col-span-1">
            <Panel title="System Health">
              <div className="grid gap-2">
                <HealthRow name="Worker" status="Unknown" />
                <HealthRow name="MongoDB" status="Unknown" />
                <HealthRow name="Redis" status="Unknown" />
                <HealthRow name="AI Engine" status="Unknown" />
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Placeholders for service status.
              </div>
            </Panel>
          </div>
        </div>

        <div className="mt-6">
          <Panel title="Top Attacking IPs" right="Top 5 source_ip values">
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-950/40">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-300">Source IP</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-300">Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {topIps.length ? (
                    topIps.map((r) => (
                      <tr key={r.ip} className="border-t border-slate-800">
                        <td className="px-4 py-3 font-mono text-slate-100">{r.ip}</td>
                        <td className="px-4 py-3 text-slate-200">{r.count}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-slate-400" colSpan={2}>
                        No alert IPs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="mt-8 border-t border-slate-900 pt-4 text-xs text-slate-500">
          {refreshedAt ? `Last refresh: ${refreshedAt.toLocaleString()}` : ''}
        </div>
      </div>
    </div>
  );
}
