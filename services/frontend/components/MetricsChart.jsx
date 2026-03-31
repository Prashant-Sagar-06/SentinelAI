import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function fmt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n;
}

export default function MetricsChart({ metrics }) {
  const data = [
    { name: 'Requests', value: fmt(metrics?.requests) },
    { name: 'Error Rate', value: Math.round(fmt(metrics?.error_rate) * 100) },
    { name: 'Latency (ms)', value: fmt(metrics?.avg_latency) },
  ];
  return (
    <div className="h-56 w-full rounded-2xl border border-soc-border bg-black/10 p-3">
      <div className="mb-2 text-xs font-semibold text-soc-muted">Metrics (selected minute)</div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />
            <XAxis
              dataKey="name"
              tick={{ fill: 'rgba(229,231,235,0.7)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'rgba(229,231,235,0.7)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{
                background: 'rgba(11, 15, 20, 0.92)',
                border: '1px solid rgba(31, 41, 55, 1)',
                borderRadius: 12,
                color: '#E5E7EB',
              }}
              itemStyle={{ color: '#E5E7EB', fontSize: 12 }}
              labelStyle={{ color: '#9CA3AF', fontSize: 12 }}
            />
            <Bar dataKey="value" fill="#3B82F6" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[11px] text-soc-muted">Error Rate is shown as %.</div>
    </div>
  );
}
