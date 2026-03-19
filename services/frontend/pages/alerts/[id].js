import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

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

export default function AlertDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [alert, setAlert] = useState(null);
  const [relatedLogs, setRelatedLogs] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [assignTo, setAssignTo] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('sentinelai_token');
    if (!token) {
      router.push('/login');
      return;
    }

    (async () => {
      const res = await fetch(`${API_BASE}/api/alerts/${id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = await res.json();
      setAlert(data.alert);
      setRelatedLogs(Array.isArray(data.related_logs) ? data.related_logs : []);
      setAiAnalysis(data.ai_analysis || null);
    })();
  }, [id, router]);

  async function refresh() {
    const token = localStorage.getItem('sentinelai_token');
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/alerts/${id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setAlert(data.alert);
      setRelatedLogs(Array.isArray(data.related_logs) ? data.related_logs : []);
      setAiAnalysis(data.ai_analysis || null);
    }
  }

  async function action(path, body) {
    const token = localStorage.getItem('sentinelai_token');
    if (!token) {
      router.push('/login');
      return;
    }

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
      if (!res.ok) throw new Error(json?.error || (await res.text().catch(() => 'Action failed')));
      if (json?.alert) setAlert(json.alert);
      await refresh();
    } catch (e) {
      setError(e?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  const severityTone = useMemo(() => {
    const s = String(alert?.severity ?? '').toLowerCase();
    if (s === 'critical') return 'bg-red-400/10 text-red-200 ring-red-500/20';
    if (s === 'high') return 'bg-orange-400/10 text-orange-200 ring-orange-500/20';
    if (s === 'medium') return 'bg-amber-400/10 text-amber-200 ring-amber-500/20';
    if (s === 'low') return 'bg-emerald-400/10 text-emerald-200 ring-emerald-500/20';
    return 'bg-slate-400/10 text-slate-200 ring-slate-500/20';
  }, [alert?.severity]);

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
      <div className="rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs text-slate-100 shadow-lg">
        <div className="text-slate-300">{label}</div>
        <div className="mt-1 flex items-center justify-between gap-6">
          <span className="text-slate-300">Events</span>
          <span className="font-semibold text-slate-100">{payload[0]?.value ?? 0}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/alerts"
              className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900/40"
            >
              ← Back
            </Link>
            <div>
              <div className="text-xs font-medium text-slate-400">Alert Investigation</div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">{alert?.title || 'Loading…'}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900 disabled:opacity-60"
              onClick={() => action('ack')}
              disabled={!alert || actionLoading}
            >
              ACK
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900 disabled:opacity-60"
              onClick={() => action('close')}
              disabled={!alert || actionLoading}
            >
              Resolve
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!alert ? (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
            Loading alert…
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-200">Alert</div>
                <div className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${severityTone}`}>{alert.severity}</div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <div className="text-xs text-slate-400">Status</div>
                  <div className="mt-0.5 text-sm text-slate-100">{alert.status}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <div className="text-xs text-slate-400">Threat Type</div>
                  <div className="mt-0.5 text-sm text-slate-100">{alert.threat_type}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <div className="text-xs text-slate-400">Source IP</div>
                  <div className="mt-0.5 text-sm font-mono text-slate-100">{alert.source_ip || '-'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <div className="text-xs text-slate-400">Actor</div>
                  <div className="mt-0.5 text-sm text-slate-100">{alert.actor || '-'}</div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <div className="text-xs text-slate-400">Reason</div>
                <div className="mt-0.5 text-sm text-slate-100">{alert.reason}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="text-sm font-semibold text-slate-200">Actions</div>
                <div className="text-xs text-slate-400">Assignment</div>
              </div>

              <div className="grid gap-2">
                <input
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  placeholder={alert.assigned_to ? `Assigned to: ${alert.assigned_to}` : 'Assign to (email or name)'}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900 disabled:opacity-60"
                  onClick={() => action('assign', { assigned_to: assignTo.trim() || null })}
                  disabled={actionLoading}
                >
                  Assign
                </button>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                Current: <span className="text-slate-200">{alert.assigned_to || 'Unassigned'}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="text-sm font-semibold text-slate-200">AI Analysis</div>
              <div className="text-xs text-slate-400">Anomaly explanations</div>
            </div>

            {aiAnalysis && Array.isArray(aiAnalysis.explanations) && aiAnalysis.explanations.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                {aiAnalysis.explanations.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-400">No AI explanations available for this alert.</div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="text-sm font-semibold text-slate-200">Timeline</div>
              <div className="text-xs text-slate-400">Related events over time</div>
            </div>

            <div className="h-56">
              {timeline.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="eventsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
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
                    <Area type="monotone" dataKey="events" stroke="#f97316" fill="url(#eventsFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">No related events yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="text-sm font-semibold text-slate-200">Related Logs</div>
            <div className="text-xs text-slate-400">Last 20 matching source_ip or actor</div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-950/40">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-300">Timestamp</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-300">Event Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-300">Message</th>
                </tr>
              </thead>
              <tbody>
                {relatedLogs.length ? (
                  relatedLogs.map((ev) => (
                    <tr key={ev._id} className="border-t border-slate-800">
                      <td className="px-4 py-3 text-slate-200">
                        {ev?.timestamp ? new Date(ev.timestamp).toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-100">{ev?.event_type || '-'}</td>
                      <td className="px-4 py-3 text-slate-200">{ev?.message || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-slate-400" colSpan={3}>
                      No related logs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
