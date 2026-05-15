import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getIncidents } from '../lib/api'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'

const STATUS_COLOR = {
  open:     'text-red-400 bg-red-950',
  resolved: 'text-green-400 bg-green-950',
  ignored:  'text-gray-400 bg-gray-800',
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
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Incidents</h2>
        <div className="flex gap-2">
          {['', 'open', 'resolved'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                ${filter === s
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}

      {!loading && incidents.length === 0 && (
        <div className="text-center py-20 text-gray-600">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-800" />
          <p>No incidents found</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {incidents.map(inc => (
          <div
            key={inc.id}
            onClick={() => navigate(`/incidents/${inc.id}`)}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{inc.title}</p>
                  <p className="text-gray-500 text-xs mt-1">{inc.server_name}</p>
                  {inc.description && (
                    <p className="text-gray-400 text-xs mt-1 line-clamp-1">{inc.description}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[inc.status]}`}>
                  {inc.status}
                </span>
                <span className="text-gray-600 text-xs flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(inc.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}