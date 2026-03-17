import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function AlertDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('sentinelai_token');
    if (!token) {
      router.push('/login');
      return;
    }

    (async () => {
      const res = await fetch(`${API_BASE}/api/alerts/${id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = await res.json();
      setAlert(data.alert);
    })();
  }, [id, router]);

  async function action(path) {
    const token = localStorage.getItem('sentinelai_token');
    const res = await fetch(`${API_BASE}/api/alerts/${id}/${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const data = await res.json();
    setAlert(data.alert);
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Link href="/alerts" className="small">← Back</Link>
        <div className="row">
          <button className="btn secondary" onClick={() => action('ack')}>Ack</button>
          <button className="btn secondary" onClick={() => action('close')}>Close</button>
        </div>
      </div>

      {error && (
        <pre className="small" style={{ whiteSpace: 'pre-wrap', color: '#b91c1c' }}>
          {error}
        </pre>
      )}

      {!alert && <div className="small">Loading…</div>}
      {alert && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>{alert.title}</h2>
          <div className="small">Severity: {alert.severity}</div>
          <div className="small">Status: {alert.status}</div>
          <div className="small">Threat: {alert.threat_type}</div>
          <div className="small">Group: {alert.group_key}</div>
          <p className="small">Reason: {alert.reason}</p>
          <div className="small">
            Occurrences: {alert.counts?.occurrences} • Last seen: {alert.counts?.last_seen_at}
          </div>
        </div>
      )}
    </div>
  );
}
