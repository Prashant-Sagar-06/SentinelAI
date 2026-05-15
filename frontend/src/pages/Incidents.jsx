import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getIncidents } from '../lib/api'

const STATUS = {
  open:     { color: 'var(--red)',    bg: 'rgba(255,68,68,0.08)',    border: 'rgba(255,68,68,0.25)',    label: 'OPEN' },
  resolved: { color: 'var(--green)',  bg: 'rgba(0,255,136,0.08)',    border: 'rgba(0,255,136,0.25)',    label: 'RESOLVED' },
  ignored:  { color: 'var(--text-3)', bg: 'rgba(61,90,122,0.08)',    border: 'rgba(61,90,122,0.25)',    label: 'IGNORED' },
}

export default function Incidents() {
  const [incidents, setIncidents] = useState([])
  const [filter,    setFilter]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    getIncidents(filter || undefined)
      .then(res => setIncidents(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: 'var(--bg-base)' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--sans)', fontWeight: '800', fontSize: '22px', color: 'var(--text-1)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Incidents</h1>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', margin: 0 }}>{incidents.length} TOTAL EVENTS</p>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {[['', 'ALL'], ['open', 'OPEN'], ['resolved', 'RESOLVED']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              background: filter === val ? 'var(--accent-glow)' : 'var(--bg-card)',
              border: `1px solid ${filter === val ? 'var(--border-lit)' : 'var(--border)'}`,
              color: filter === val ? 'var(--accent)' : 'var(--text-2)',
              borderRadius: '8px', padding: '7px 14px',
              fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: '700',
              cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.06em',
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-3)' }}>
          LOADING<span className="blink">_</span>
        </div>
      )}

      {!loading && incidents.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>◎</div>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-3)' }}>NO INCIDENTS FOUND</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {incidents.map((inc, i) => {
          const s = STATUS[inc.status] || STATUS.ignored
          return (
            <div key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', animationDelay: `${i * 0.03}s` }}
              className="fade-up"
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-lit)'; e.currentTarget.style.transform = 'translateX(4px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateX(0)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, boxShadow: `0 0 8px ${s.color}`, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--sans)', fontWeight: '600', fontSize: '14px', color: 'var(--text-1)', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inc.title}</p>
                  <p style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', margin: 0 }}>{inc.server_name} · {new Date(inc.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: '700', color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '3px 10px', borderRadius: '4px', letterSpacing: '0.06em' }}>{s.label}</span>
                <span style={{ color: 'var(--text-3)', fontSize: '16px' }}>›</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}