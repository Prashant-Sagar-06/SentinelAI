import { useEffect, useState, useRef } from 'react'

export function useWebSocket(serverName) {
  const [metrics, setMetrics] = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!serverName) return

    const token   = localStorage.getItem('token')
    const wsUrl   = import.meta.env.VITE_WS_URL
    const url     = `${wsUrl}/ws/live?token=${token}&server_name=${serverName}`

    const connect = () => {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen    = () => setConnected(true)
      ws.onmessage = (e) => setMetrics(JSON.parse(e.data))
      ws.onclose   = () => {
        setConnected(false)
        setTimeout(connect, 3000)   // auto-reconnect after 3s
      }
      ws.onerror   = () => ws.close()
    }

    connect()
    return () => wsRef.current?.close()
  }, [serverName])

  return { metrics, connected }
}