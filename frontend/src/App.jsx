import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Navbar       from './components/Navbar'
import Login        from './pages/Login'
import Register     from './pages/Register'
import Dashboard    from './pages/Dashboard'
import Incidents    from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'
import Chat         from './pages/Chat'
import APIKeys      from './pages/APIKeys'

// Wraps pages that require login
function ProtectedLayout() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      Loading...
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="flex min-h-screen">
      <Navbar />
      <Outlet />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected */}
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard"          element={<Dashboard />} />
            <Route path="/incidents"          element={<Incidents />} />
            <Route path="/incidents/:id"      element={<IncidentDetail />} />
            <Route path="/chat"               element={<Chat />} />
            <Route path="/api-keys"           element={<APIKeys />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}