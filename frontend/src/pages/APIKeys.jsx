import { useState, useEffect } from 'react'
import { getAPIKeys, createAPIKey } from '../lib/api'

export default function APIKeys() {
  const [keys,    setKeys]    = useState([])
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(null)

  useEffect(() => { getAPIKeys().then(res => setKeys(res.data)).catch(() => {}) }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await createAPIKey(name.trim())
      setKeys(prev => [...prev, res.data])
      setName('')
    } catch { alert('Failed to create API key') }
    finally { setLoading(false) }
  }

  const copyKey = (key) => {
    navigator.clipboard.writeText(key)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: 'var(--bg-base)', maxWidth: '760px' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: 'var(--sans)', fontWeight: '800', fontSize: '22px', color: 'var(--text-1)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>◎ API Keys</h1>
        <p style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', margin: 0 }}>AUTHENTICATE YOUR AGENTS</p>
      </div>

      {/* Create new key */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', marginBottom: '12px', position: 'relative', overflow: 'hidden' }} className="fade-up">
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
        <p style={{ fontFamily: 'var(--sans)', fontWeight: '600', fontSize: '13px', color: 'var(--text-1)', margin: '0 0 14px' }}>Generate New Key</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="key name (e.g. prod-server-1)"
            style={{ flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-1)', outline: 'none', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button onClick={handleCreate} disabled={loading || !name.trim()}
            style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '8px', padding: '10px 20px', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: '700', cursor: (loading || !name.trim()) ? 'not-allowed' : 'pointer', opacity: (loading || !name.trim()) ? 0.5 : 1, letterSpacing: '0.06em', boxShadow: '0 0 16px var(--accent-glow)', transition: 'opacity 0.15s', whiteSpace: 'nowrap' }}>
            {loading ? 'CREATING...' : '+ CREATE'}
          </button>
        </div>
      </div>

      {/* Keys list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {keys.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-3)' }}>
            NO KEYS YET — CREATE ONE ABOVE
          </div>
        )}
        {keys.map((k, i) => (
          <div key={k.id} className="fade-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', animationDelay: `${i * 0.04}s`, transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-lit)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-glow)', border: '1px solid var(--border-lit)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>◎</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--sans)', fontWeight: '600', fontSize: '13px', color: 'var(--text-1)', margin: '0 0 3px' }}>{k.name}</p>
                <p style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.key.slice(0, 20)}••••••••••••</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-3)' }}>{new Date(k.created_at).toLocaleDateString()}</span>
              <button onClick={() => copyKey(k.key)}
                style={{ background: copied === k.key ? 'rgba(0,255,136,0.1)' : 'var(--bg-base)', border: `1px solid ${copied === k.key ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`, color: copied === k.key ? 'var(--green)' : 'var(--text-2)', borderRadius: '6px', padding: '5px 12px', fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.06em' }}>
                {copied === k.key ? '✓ COPIED' : 'COPY'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Agent setup instructions */}
      {keys.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }} className="fade-up">
          <p style={{ fontFamily: 'var(--sans)', fontWeight: '600', fontSize: '13px', color: 'var(--text-1)', margin: '0 0 14px' }}>Agent Setup</p>
          <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px 18px', fontFamily: 'var(--mono)', fontSize: '12px', lineHeight: 2.0 }}>
            {[
              { color: 'var(--text-3)', text: '# Install dependencies' },
              { color: 'var(--green)', prefix: '$ ', text: 'pip install psutil httpx' },
              { color: 'var(--text-3)', text: '' },
              { color: 'var(--text-3)', text: '# Set environment variables' },
              { color: 'var(--yellow)', text: `SENTINEL_API_KEY=${keys[0]?.key?.slice(0, 16)}...` },
              { color: 'var(--yellow)', text: 'SENTINEL_API_URL=http://your-ec2-ip:8000/api/metrics/ingest' },
              { color: 'var(--yellow)', text: 'SENTINEL_SERVER_NAME=your-server-name' },
              { color: 'var(--text-3)', text: '' },
              { color: 'var(--text-3)', text: '# Run the agent' },
              { color: 'var(--green)', prefix: '$ ', text: 'python agent.py' },
            ].map((line, i) => (
              <div key={i} style={{ color: line.color }}>
                {line.prefix && <span style={{ color: 'var(--accent)' }}>{line.prefix}</span>}
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}