import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardHeader } from '../ui';

function MiniTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-soc-border bg-soc-bg/90 px-3 py-2 text-xs text-soc-text shadow-card">
      <div className="text-soc-muted">{label}</div>
      <div className="mt-1 grid gap-1">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-6">
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
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="mt-3 h-56">{children}</div>
    </Card>
  );
}

export default function Charts({ series }) {
  const safeSeries = Array.isArray(series) ? series : [];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Panel title="Requests Trend" subtitle="Requests/min">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeSeries} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#1F2937" strokeDasharray="4 6" />
            <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} allowDecimals={false} />
            <Tooltip content={<MiniTooltip />} />
            <Line name="Requests/min" type="monotone" dataKey="requests_per_minute" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Error Rate Trend" subtitle="Error rate">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeSeries} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#1F2937" strokeDasharray="4 6" />
            <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} />
            <Tooltip content={<MiniTooltip />} />
            <Line name="Error rate" type="monotone" dataKey="error_rate" stroke="#F59E0B" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Latency Graph" subtitle="Avg latency (ms)">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeSeries} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#1F2937" strokeDasharray="4 6" />
            <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#1F2937' }} tickLine={false} />
            <Tooltip content={<MiniTooltip />} />
            <Line name="Avg latency" type="monotone" dataKey="avg_latency_ms" stroke="#10B981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
