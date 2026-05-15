import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

// Attach JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auth ──────────────────────────────────────────────────────────────
export const register   = (email, password)   => api.post('/api/auth/register',  { email, password })
export const login      = (email, password)   => api.post('/api/auth/login',     { email, password })
export const getMe      = ()                  => api.get('/api/auth/me')
export const getAPIKeys = ()                  => api.get('/api/auth/api-keys')
export const createAPIKey = (name)            => api.post('/api/auth/api-keys',  { name })

// ── Metrics ───────────────────────────────────────────────────────────
export const getLatest  = (server_name)       => api.get('/api/metrics/latest',  { params: { server_name } })
export const getHistory = (server_name, limit=60) => api.get('/api/metrics/history', { params: { server_name, limit } })

// ── Incidents ─────────────────────────────────────────────────────────
export const getIncidents   = (status)        => api.get('/api/incidents/',       { params: status ? { status } : {} })
export const getIncident    = (id)            => api.get(`/api/incidents/${id}`)
export const resolveIncident= (id, action)    => api.patch(`/api/incidents/${id}/resolve`, { action_taken: action })

// ── AI ────────────────────────────────────────────────────────────────
export const analyzeIncident = (incident_id)              => api.post('/api/ai/analyze',     { incident_id })
export const explainLog      = (log_text, server_name)    => api.post('/api/ai/explain-log', { log_text, server_name })
export const sendChat        = (message, server_name)     => api.post('/api/ai/chat',        { message, server_name })
export const getRecommend    = (server_name)              => api.post('/api/ai/recommend',   { server_name })

export default api