import { useState, useRef, useEffect } from 'react'
import { sendChat } from '../lib/api'
import { Send, Sparkles } from 'lucide-react'

export default function Chat() {
  const [messages,    setMessages]    = useState([
    { role: 'assistant', content: 'Hi! I\'m Sentinel AI. Ask me anything about your infrastructure — incidents, metrics, performance, or best practices.' }
  ])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [serverName,  setServerName]  = useState(localStorage.getItem('serverName') || '')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="flex-1 flex flex-col p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Sparkles size={20} className="text-brand-500" /> AI Chat
        </h2>
        <input
          value={serverName}
          onChange={e => setServerName(e.target.value)}
          placeholder="Server context (optional)"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:border-brand-500"
        />
      </div>

      {/* Messages */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-y-auto flex flex-col gap-4 min-h-0 mb-4" style={{ maxHeight: 'calc(100vh - 260px)' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
              ${msg.role === 'user'
                ? 'bg-brand-500 text-white rounded-br-sm'
                : 'bg-gray-800 text-gray-200 rounded-bl-sm'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-400 px-4 py-3 rounded-2xl rounded-bl-sm text-sm">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about your infrastructure... (Enter to send)"
          rows={2}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-brand-500"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 rounded-xl transition-colors disabled:opacity-50 self-end pb-3 pt-3"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}