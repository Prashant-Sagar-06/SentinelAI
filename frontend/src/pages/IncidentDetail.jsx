import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getIncident, resolveIncident, analyzeIncident } from '../lib/api'

export default function IncidentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [incident,  setIncident]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    getIncident(id).then(res => setIncident(res.data)).catch(() => navigate('/incidents')).finally(() => setLoading(false))
  }, [id])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const res = await analyzeIncident(id)
      setIncident(prev => ({ ...prev, ai_analysis: res.data.result }))
    } catch { alert('AI analysis failed. Check your Groq API key.') }
    finally { setAnalyzing(false) }
  }

  const handleResolve = async () => {
    setResolving(true)
    try {
      const res = await resolveIncident(id, 'Manually resolved from dashboard')
      setIncident(res.data)
    } catch { alert('Failed to resolve') }
    finally { setResolving(false) }
  }

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-3)' }}>LOADING<span className="blink">_</span></div>
  if (!incident) return null

  const isOpen = incident.status === 'open'

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: 'var(--bg-base)', maxWidth: '800px' }}>

      <button onClick={() => navigate('/incidents')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: '11px', cursor: 'pointer', marginBottom: '24px', padding: 0, transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
      >‹ BACK TO INCIDENTS</button>

      {/* Header card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', marginBottom: '12px', position: 'relative', overflow: 'hidden' }} className="fade-up">
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${isOpen ? 'var(--red)' : 'var(--green)'}, transparent)` }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
          <h2 style={{ fontFamily: 'var(--sans)', fontWeight: '700', fontSize: '18px', color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>{incident.title}</h2>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: '700', color: isOpen ? 'var(--red)' : 'var(--green)', background: isOpen ? 'rgba(255,68,68,0.08)' : 'rgba(0,255,136,0.08)', border: `1px solid ${isOpen ? 'rgba(255,68,68,0.3)' : 'rgba(0,255,136,0.3)'}`, padding: '4px 10px', borderRadius: '4px', whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
            {incident.status.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[
            { label: 'Server', value: incident.server_name },
            { label: 'Detected', value: new Date(incident.created_at).toLocaleString() },
            incident.resolved_at && { label: 'Resolved', value: new Date(incident.resolved_at).toLocaleString() },
          ].filter(Boolean).map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--bg-base)', borderRadius: '8px', padding: '12px 14px' }}>
              <p style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
              <p style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-1)', margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {incident.description && (
          <div style={{ background: 'var(--bg-base)', borderRadius: '8px', padding: '12px 14px', marginTop: '12px' }}>
            <p style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-3)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</p>
            <p style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>{incident.description}</p>
          </div>
        )}
      </div>

      {/* AI Analysis */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', marginBottom: '12px', position: 'relative', overflow: 'hidden' }} className="fade-up-1">
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <p style={{ fontFamily: 'var(--sans)', fontWeight: '600', fontSize: '14px', color: 'var(--text-1)', margin: '0 0 2px' }}>◈ AI Root Cause Analysis</p>
            <p style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-3)', margin: 0 }}>POWERED BY GROQ</p>
          </div>
          {!incident.ai_analysis && (
            <button onClick={handleAnalyze} disabled={analyzing} style={{ background: 'var(--accent-glow)', border: '1px solid var(--border-lit)', color: 'var(--accent)', borderRadius: '8px', padding: '8px 16px', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: '700', cursor: analyzing ? 'not-allowed' : 'pointer', opacity: analyzing ? 0.6 : 1, letterSpacing: '0.06em', transition: 'all 0.15s' }}>
              {analyzing ? 'ANALYZING...' : 'RUN ANALYSIS →'}
            </button>
          )}
        </div>

        {incident.ai_analysis
          ? <p style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>{incident.ai_analysis}</p>
          : <p style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-3)', margin: 0 }}>Click Run Analysis to get AI-powered root cause analysis from Groq.</p>
        }
      </div>

      {/* Resolve */}
      {isOpen && (
        <button onClick={handleResolve} disabled={resolving} className="fade-up-2"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.3)', color: 'var(--green)', borderRadius: '10px', padding: '12px 20px', fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: '700', cursor: resolving ? 'not-allowed' : 'pointer', opacity: resolving ? 0.6 : 1, letterSpacing: '0.06em', transition: 'all 0.15s' }}
          onMouseEnter={e => { if (!resolving) e.currentTarget.style.background = 'rgba(0,255,136,0.14)' }}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,255,136,0.08)'}
        >
          ✓ {resolving ? 'RESOLVING...' : 'MARK AS RESOLVED'}
        </button>
      )}
    </div>
  )
}