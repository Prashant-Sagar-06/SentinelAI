import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { login } from '../lib/api'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const { signin } = useAuth()
  const navigate   = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(email, password)
      await signin(res.data.access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>

      {/* Background grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '48px 48px', opacity: 0.4 }} />

      {/* Glow orb */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: '400px', padding: '0 20px' }} className="fade-up">

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))', borderRadius: '12px', marginBottom: '16px', boxShadow: '0 0 32px var(--accent-glow)' }}>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: '700', fontSize: '20px', color: '#000' }}>S</span>
          </div>
          <h1 style={{ fontFamily: 'var(--sans)', fontWeight: '800', fontSize: '24px', color: 'var(--text-1)', margin: '0 0 4px', letterSpacing: '-0.03em' }}>
            Sentinel<span style={{ color: 'var(--accent)' }}>AI</span>
          </h1>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', margin: 0 }}>INFRASTRUCTURE MONITORING</p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />

          <h2 style={{ fontFamily: 'var(--sans)', fontWeight: '700', fontSize: '16px', color: 'var(--text-1)', margin: '0 0 6px' }}>Sign in</h2>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', margin: '0 0 24px' }}>Access your monitoring dashboard</p>

          {error && (
            <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--red)' }}>
              ⚠ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'Email', type: 'email', val: email, set: setEmail, placeholder: 'you@example.com' },
              { label: 'Password', type: 'password', val: password, set: setPassword, placeholder: '••••••••' },
            ].map(({ label, type, val, set, placeholder }) => (
              <div key={label}>
                <label style={{ fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: '700', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>{label}</label>
                <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={placeholder} required
                  style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-1)', outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            ))}

            <button type="submit" disabled={loading} style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '8px', padding: '12px', fontFamily: 'var(--sans)', fontSize: '13px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '0.04em', boxShadow: '0 0 20px var(--accent-glow)', marginTop: '4px', transition: 'opacity 0.15s' }}>
              {loading ? 'SIGNING IN...' : 'SIGN IN →'}
            </button>
          </form>

          <p style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', textAlign: 'center', marginTop: '20px', marginBottom: 0 }}>
            No account?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}