import { useState, useRef, useEffect } from 'react'
import { sendChat } from '../lib/api'

export default function Chat() {
  const [messages,   setMessages]   = useState([{ role: 'assistant', content: "Hello. I'm Sentinel AI. Ask me anything about your infrastructure — incidents, metrics, performance, or DevOps best practices." }])
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [serverName, setServerName] = useState(localStorage.getItem('serverName') || '')
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async () => {
    const msg = input.trim()
    if (!msg || loading) return
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setInput('')
    setLoading(true)
    try {
      const res = await sendChat(msg, serverName || undefined)
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.result }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally { setLoading(false) }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', background: 'var(--bg-base)', maxWidth: '800px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--sans)', fontWeight: '800', fontSize: '22px', color: 'var(--text-1)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>◈ AI Chat</h1>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', margin: 0 }}>POWERED BY GROQ · LLAMA 3</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-3)' }}>SERVER</span>
          <input value={serverName} onChange={e => setServerName(e.target.value)} placeholder="optional context..."
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-1)', outline: 'none', width: '160px', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0, marginBottom: '12px', maxHeight: 'calc(100vh - 280px)' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#000', flexShrink: 0, marginRight: '10px', marginTop: '2px' }}>S</div>
            )}
            <div style={{
              maxWidth: '75%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-base)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
              color: msg.role === 'user' ? '#000' : 'var(--text-2)',
              fontFamily: 'var(--mono)', fontSize: '13px', lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}>{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#000' }}>S</div>
            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '12px 12px 12px 4px', padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-3)' }}>
              THINKING<span className="blink">_</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }}} placeholder="Ask about your infrastructure... (Enter to send)" rows={2}
          style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-1)', outline: 'none', resize: 'none', transition: 'border-color 0.15s' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '0 20px', color: '#000', fontFamily: 'var(--mono)', fontSize: '16px', cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer', opacity: (loading || !input.trim()) ? 0.4 : 1, boxShadow: '0 0 16px var(--accent-glow)', transition: 'opacity 0.15s', alignSelf: 'stretch' }}>
          →
        </button>
      </div>
    </div>
  )
}