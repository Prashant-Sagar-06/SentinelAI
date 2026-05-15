import { useState, useEffect } from 'react'
import { getAPIKeys, createAPIKey } from '../lib/api'
import { Key, Copy, Plus, Check } from 'lucide-react'

export default function APIKeys() {
  const [keys,    setKeys]    = useState([])
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(null)

  useEffect(() => {
    getAPIKeys().then(res => setKeys(res.data)).catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await createAPIKey(name.trim())
      setKeys(prev => [...prev, res.data])
      setName('')
    } catch {
      alert('Failed to create API key')
    } finally {
      setLoading(false)
    }
  }

  const copyKey = (key) => {
    navigator.clipboard.writeText(key)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-2xl">
      <h2 className="text-xl font-bold mb-2">API Keys</h2>
      <p className="text-gray-400 text-sm mb-6">
        Use these keys in your agent. Set <code className="bg-gray-800 px-1 rounded text-xs">SENTINEL_API_KEY</code> on your server.
      </p>

      {/* Create new key */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <p className="text-sm font-medium mb-3">Create new key</p>
        <div className="flex gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Key name (e.g. prod-server-1)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          />
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <Plus size={16} /> Create
          </button>
        </div>
      </div>

      {/* Key list */}
      <div className="flex flex-col gap-3">
        {keys.length === 0 && (
          <p className="text-gray-600 text-sm">No API keys yet. Create one above.</p>
        )}
        {keys.map(k => (
          <div key={k.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Key size={16} className="text-brand-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{k.name}</p>
                <p className="text-gray-600 text-xs font-mono truncate">{k.key}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-gray-600 text-xs">{new Date(k.created_at).toLocaleDateString()}</span>
              <button
                onClick={() => copyKey(k.key)}
                className="text-gray-400 hover:text-white transition-colors"
                title="Copy key"
              >
                {copied === k.key ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Agent setup instructions */}
      {keys.length > 0 && (
        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-medium mb-3">Agent setup</p>
          <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-300 space-y-1">
            <p><span className="text-green-400">pip install</span> psutil httpx</p>
            <p><span className="text-yellow-400">set</span> SENTINEL_API_KEY=<span className="text-brand-500">{keys[0]?.key}</span></p>
            <p><span className="text-yellow-400">set</span> SENTINEL_API_URL=<span className="text-brand-500">http://your-ec2-ip:8000/api/metrics/ingest</span></p>
            <p><span className="text-yellow-400">set</span> SENTINEL_SERVER_NAME=<span className="text-brand-500">your-server-name</span></p>
            <p><span className="text-green-400">python</span> agent.py</p>
          </div>
        </div>
      )}
    </div>
  )
}