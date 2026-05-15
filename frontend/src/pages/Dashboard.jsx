import { useState, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { getHistory } from '../lib/api'
import MetricCard from '../components/MetricCard'
import MetricChart from '../components/MetricChart'

export default function Dashboard() {
  const [serverName, setServerName] = useState(localStorage.getItem('serverName') || '')
  const [input,      setInput]      = useState(localStorage.getItem('serverName') || '')
  const [history,    setHistory]    = useState([])
  const { metrics, connected }      = useWebSocket(serverName)

  useEffect(() => {
    if (!serverName) return
    getHistory(serverName).then(res => setHistory(res.data)).catch(() => {})
  }, [serverName])

  useEffect(() => {
    if (!metrics) return
    setHistory(prev => [...prev, metrics].slice(-60))
  }, [metrics])

  const apply = () => {
    localStorage.setItem('serverName', input)
    setServerName(input)
  }

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--sans)', fontWeight: '800', fontSize: '22px', color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>
            Live Dashboard
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--text-3)', boxShadow: connected ? '0 0 8px var(--green)' : 'none', display: 'inline-block' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: connected ? 'var(--green)' : 'var(--text-3)' }}>
              {connected ? `CONNECTED · ${serverName}` : 'WAITING FOR AGENT'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && apply()}
            placeholder="server name..."
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '8px 14px',
              fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-1)',
              outline: 'none', width: '200px',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button onClick={apply} style={{
            background: 'var(--accent)', color: '#000',
            border: 'none', borderRadius: '8px', padding: '8px 18px',
            fontFamily: 'var(--sans)', fontSize: '12px', fontWeight: '700',
            cursor: 'pointer', letterSpacing: '0.04em',
            boxShadow: '0 0 16px var(--accent-glow)',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >CONNECT</button>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }} className="fade-up-1">
        <MetricCard label="CPU Usage"    value={metrics?.cpu_percent}    icon="🖥" />
        <MetricCard label="Memory"       value={metrics?.memory_percent}  icon="◉" />
        <MetricCard label="Disk"         value={metrics?.disk_percent}    icon="⬡" />
        <MetricCard label="Net Sent" value={metrics ? (metrics.net_bytes_sent / 1024 / 1024).toFixed(2) : null} unit=" MB" icon="⇡" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }} className="fade-up-2">
        <MetricChart data={history} dataKey="cpu_percent"    label="CPU History"    color="#00d4ff" />
        <MetricChart data={history} dataKey="memory_percent" label="Memory History" color="#ff6b35" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="fade-up-3">
        <MetricChart data={history} dataKey="disk_percent"   label="Disk Usage"     color="#a855f7" />
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontFamily: 'var(--sans)', fontSize: '11px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>System Status</div>
          {[
            { label: 'CPU',    val: metrics?.cpu_percent,    warn: 85, crit: 95 },
            { label: 'Memory', val: metrics?.memory_percent, warn: 80, crit: 90 },
            { label: 'Disk',   val: metrics?.disk_percent,   warn: 80, crit: 90 },
          ].map(({ label, val, warn, crit }) => {
            const n   = val != null ? parseFloat(val) : null
            const col = n == null ? 'var(--text-3)' : n >= crit ? 'var(--red)' : n >= warn ? 'var(--yellow)' : 'var(--green)'
            const status = n == null ? 'NO DATA' : n >= crit ? 'CRITICAL' : n >= warn ? 'WARNING' : 'NORMAL'
            return (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-2)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: '700', color: col, background: `${col}18`, padding: '2px 8px', borderRadius: '4px' }}>{status}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}