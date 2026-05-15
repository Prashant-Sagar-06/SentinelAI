import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getIncident, resolveIncident, analyzeIncident } from '../lib/api'
import { ArrowLeft, Sparkles, CheckCircle } from 'lucide-react'

export default function IncidentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [incident,  setIncident]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    getIncident(id)
      .then(res => setIncident(res.data))
      .catch(() => navigate('/incidents'))
      .finally(() => setLoading(false))
  }, [id])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const res = await analyzeIncident(id)
      setIncident(prev => ({ ...prev, ai_analysis: res.data.result }))
    } catch (err) {
      alert('AI analysis failed. Check your Grok API key.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleResolve = async () => {
    setResolving(true)
    try {
      const res = await resolveIncident(id, 'Manually resolved from dashboard')
      setIncident(res.data)
    } catch (err) {
      alert('Failed to resolve incident')
    } finally {
      setResolving(false)
    }
  }

  if (loading) return <div className="flex-1 p-8 text-gray-500">Loading...</div>
  if (!incident) return null

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-3xl">
      <button
        onClick={() => navigate('/incidents')}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Incidents
      </button>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold">{incident.title}</h2>
          <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0
            ${incident.status === 'open' ? 'text-red-400 bg-red-950' : 'text-green-400 bg-green-950'}`}>
            {incident.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Server</p>
            <p className="text-gray-200">{incident.server_name}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Detected at</p>
            <p className="text-gray-200">{new Date(incident.created_at).toLocaleString()}</p>
          </div>
          {incident.resolved_at && (
            <div>
              <p className="text-gray-500 text-xs">Resolved at</p>
              <p className="text-gray-200">{new Date(incident.resolved_at).toLocaleString()}</p>
            </div>
          )}
        </div>

        {incident.description && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-gray-400 text-xs mb-1">Description</p>
            <p className="text-gray-200 text-sm">{incident.description}</p>
          </div>
        )}
      </div>

      {/* AI Analysis */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="font-medium flex items-center gap-2">
            <Sparkles size={16} className="text-brand-500" /> AI Root Cause Analysis
          </p>
          {!incident.ai_analysis && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="bg-brand-500 hover:bg-brand-600 text-white text-sm px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {analyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          )}
        </div>

        {incident.ai_analysis
          ? <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{incident.ai_analysis}</p>
          : <p className="text-gray-600 text-sm">Click Analyze to get AI-powered root cause analysis.</p>
        }
      </div>

      {/* Resolve */}
      {incident.status === 'open' && (
        <button
          onClick={handleResolve}
          disabled={resolving}
          className="flex items-center gap-2 bg-green-800 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <CheckCircle size={16} />
          {resolving ? 'Resolving...' : 'Mark as Resolved'}
        </button>
      )}
    </div>
  )
}