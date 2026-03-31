import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function classNames(...xs) {
  return xs.filter(Boolean).join(' ');
}

function MiniTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-soc-border bg-soc-bg/90 px-3 py-2 text-xs text-soc-text shadow-card">
      <div className="text-soc-muted">{label}</div>
      <div className="mt-1 grid gap-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6">
            <span className="text-soc-muted">{p.name}</span>
            <span className="font-semibold text-soc-text">{p.value ?? '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-soc-border bg-black/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-soc-text">{title}</div>
        {subtitle ? <div className="text-[11px] text-soc-muted">{subtitle}</div> : null}
      </div>
      <div className="mt-2 h-44">{children}</div>
    </div>
  );
}

export default function PerfCharts({ series, topIps }) {
  const safeSeries = Array.isArray(series) ? series : [];
  const safeTopIps = Array.isArray(topIps) ? topIps : [];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Panel title="Requests Over Time" subtitle="polling /api/metrics/summary">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#1F2937" strokeDasharray="4 6" />
            <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} allowDecimals={false} />
            <Tooltip content={<MiniTooltip />} />
            <Line name="Requests/min" type="monotone" dataKey="requests_per_minute" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Error Rate Trend" subtitle="% of requests">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#1F2937" strokeDasharray="4 6" />
            <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} />
            <Tooltip content={<MiniTooltip />} />
            <Line name="Error rate" type="monotone" dataKey="error_rate" stroke="#F59E0B" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Latency Trend" subtitle="avg ms">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#1F2937" strokeDasharray="4 6" />
            <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} />
            <Tooltip content={<MiniTooltip />} />
            <Line name="Avg latency" type="monotone" dataKey="avg_latency_ms" stroke="#10B981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Top IPs" subtitle="last 60s">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={safeTopIps} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#1F2937" strokeDasharray="4 6" />
            <XAxis dataKey="ip" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} interval={0} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} allowDecimals={false} />
            <Tooltip content={<MiniTooltip />} />
            <Bar name="Requests" dataKey="count" fill="#EF4444" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {!safeTopIps.length ? (
          <div className={classNames('mt-2 text-[11px] text-soc-muted')}>No IP activity yet.</div>
        ) : null}
      </Panel>
    </div>
  );
}
