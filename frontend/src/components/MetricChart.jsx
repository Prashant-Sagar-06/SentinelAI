import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-lit)', borderRadius: '8px', padding: '8px 12px' }}>
      <p style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-2)', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: '700', color: payload[0].color }}>
        {parseFloat(payload[0].value).toFixed(1)}%
      </p>
    </div>
  )
}

export default function MetricChart({ data, dataKey, label, color = '#00d4ff' }) {
  const formatted = data?.map(d => ({
    ...d,
    time: new Date(d.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })) ?? []

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      {/* Background gradient */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at bottom left, ${color}08, transparent 60%)`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: '11px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
        </div>

        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--mono)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--mono)' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}