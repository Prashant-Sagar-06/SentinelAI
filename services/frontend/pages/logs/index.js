import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

async function fetchLogs({ token, page, limit }) {
  const res = await fetch(`${API_BASE}/api/logs?page=${page}&limit=${limit}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export default function LogsExplorer() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('sentinelai_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    setError(null);

    fetchLogs({ token, page, limit })
      .then((data) => {
        setItems(data.data || []);
        setTotal(data.total || 0);
      })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }, [router, page, limit]);

  const canPrev = page > 1;
  const canNext = page * limit < total;

  return (
    <div className="container">
      <h1>Logs Explorer</h1>

      {error && (
        <pre className="small" style={{ whiteSpace: 'pre-wrap', color: '#b91c1c' }}>
          {error}
        </pre>
      )}

      {loading && <div className="small">Loading…</div>}

      {!loading && !items.length && <div className="small">No logs available</div>}

      {!!items.length && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Timestamp</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Source</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Event Type</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Actor</th>
                <th style={{ textAlign: 'left', padding: 8 }}>IP</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Attributes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.event_id}>
                  <td style={{ padding: 8 }}>
                    <span className="small">{l.timestamp}</span>
                  </td>
                  <td style={{ padding: 8 }}>{l.source}</td>
                  <td style={{ padding: 8 }}>{l.event_type}</td>
                  <td style={{ padding: 8 }}>{l.actor || '-'}</td>
                  <td style={{ padding: 8 }}>{l.ip || '-'}</td>
                  <td style={{ padding: 8 }}>
                    <pre className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(l.attributes || {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
        <div className="small">
          Page {page} • Total {total}
        </div>
        <div className="row">
          <button className="btn secondary" disabled={!canPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous page
          </button>
          <button className="btn secondary" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
            Next page
          </button>
        </div>
      </div>
    </div>
  );
}
