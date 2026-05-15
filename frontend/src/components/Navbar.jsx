import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const links = [
  { to: '/dashboard', label: 'Dashboard',  icon: '⬡' },
  { to: '/incidents', label: 'Incidents',  icon: '⚠' },
  { to: '/chat',      label: 'AI Chat',    icon: '◈' },
  { to: '/api-keys',  label: 'API Keys',   icon: '◎' },
]

export default function Navbar() {
  const { user, signout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  return (
    <aside style={{
      width: '220px', minHeight: '100vh',
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{
            width: '28px', height: '28px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: '700', color: '#000',
            boxShadow: '0 0 16px var(--accent-glow)',
          }}>S</div>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: '700', fontSize: '16px', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Sentinel<span style={{ color: 'var(--accent)' }}>AI</span>
          </span>
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-3)', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email}
        </div>
      </div>

      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {links.map(({ to, label, icon }) => {
          const active = location.pathname === to
          return (
            <Link key={to} to={to} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '8px',
                fontFamily: 'var(--sans)', fontSize: '13px', fontWeight: active ? '600' : '500',
                color: active ? 'var(--accent)' : 'var(--text-2)',
                background: active ? 'var(--accent-glow)' : 'transparent',
                border: `1px solid ${active ? 'var(--border-lit)' : 'transparent'}`,
                transition: 'all 0.15s', cursor: 'pointer',
              }}>
                <span style={{ fontSize: '15px', opacity: active ? 1 : 0.6 }}>{icon}</span>
                {label}
                {active && <span style={{ marginLeft: 'auto', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />}
              </div>
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
        <div onClick={() => { signout(); navigate('/login') }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', fontFamily: 'var(--sans)', fontSize: '13px', fontWeight: '500', color: 'var(--text-3)', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'rgba(255,68,68,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent' }}
        >
          <span>⏻</span> Sign out
        </div>
      </div>
    </aside>
  )
}