export default function MetricCard({ label, value, unit = '%', icon }) {
  const num = value != null ? parseFloat(value) : null
  const color = num >= 90 ? 'var(--red)' : num >= 75 ? 'var(--yellow)' : 'var(--green)'
  const glow  = num >= 90 ? 'rgba(255,68,68,0.12)' : num >= 75 ? 'rgba(255,184,0,0.12)' : 'rgba(0,255,136,0.08)'

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-lit)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at top right, ${glow}, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: num != null ? 0.6 : 0.2 }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: '11px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
          <span style={{ fontSize: '16px', opacity: 0.7 }}>{icon}</span>
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '28px', fontWeight: '700', color: num != null ? color : 'var(--text-3)', textShadow: num != null ? `0 0 20px ${color}66` : 'none', letterSpacing: '-0.02em' }}>
          {num != null ? `${num.toFixed(1)}${unit}` : '—'}
        </div>
        {num != null && (
          <div style={{ marginTop: '12px', height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(num, 100)}%`, background: color, boxShadow: `0 0 6px ${color}`, borderRadius: '2px', transition: 'width 0.5s ease' }} />
          </div>
        )}
      </div>
    </div>
  )
}