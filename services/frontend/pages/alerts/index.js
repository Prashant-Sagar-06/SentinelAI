import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Link from 'next/link';
import { useRouter } from 'next/router';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

function badge(sev) {
  return <span className="badge">{sev}</span>;
}

function fmtTime(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString();
}

export default function Alerts() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('sentinelai_token');
    if (!token) {
      router.push('/login');
      return;
    }

    (async () => {
      const res = await fetch(`${API_BASE}/api/alerts?limit=50`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = await res.json();
      setItems(data.items || []);
    })();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('sentinelai_token');
    if (!token) return undefined;

    async function refresh() {
      try {
        const res = await fetch(`${API_BASE}/api/alerts?limit=50`, { headers: { authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok && !cancelled) setItems(data.items || []);
      } catch {
        // best-effort; page already shows errors for initial load
      }
    }

    const socket = io(API_BASE);

    socket.on('connect_error', () => {
      // no-op; best-effort realtime
    });

    socket.on('alert_created', () => {
      refresh();
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, []);

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Alerts</h1>
        <button
          className="btn secondary"
          onClick={() => {
            localStorage.removeItem('sentinelai_token');
            router.push('/login');
          }}
        >
          Logout
        </button>
      </div>

      {error && (
        <pre className="small" style={{ whiteSpace: 'pre-wrap', color: '#b91c1c' }}>
          {error}
        </pre>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((a) => (
          <Link key={a._id} href={`/alerts/${a._id}`}>
            <div className="card" style={{ cursor: 'pointer' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{a.title}</strong>
                {badge(a.severity)}
              </div>
              <div className="small">{a.threat_type} • {a.status}</div>
              <div className="small">
                Events: {a.event_count ?? a.counts?.occurrences ?? 1}
              </div>
              <div className="small">
                First Seen: {fmtTime(a.first_seen ?? a.counts?.first_seen_at ?? a.createdAt)} • Last Seen:{' '}
                {fmtTime(a.last_seen ?? a.counts?.last_seen_at ?? a.updatedAt)}
              </div>
              <div className="small">{a.reason}</div>
            </div>
          </Link>
        ))}
        {!items.length && <div className="small">No alerts yet.</div>}
      </div>
    </div>
  );
}
