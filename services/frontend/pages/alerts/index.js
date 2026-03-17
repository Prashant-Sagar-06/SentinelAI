import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

function badge(sev) {
  return <span className="badge">{sev}</span>;
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
              <div className="small">{a.reason}</div>
            </div>
          </Link>
        ))}
        {!items.length && <div className="small">No alerts yet.</div>}
      </div>
    </div>
  );
}
