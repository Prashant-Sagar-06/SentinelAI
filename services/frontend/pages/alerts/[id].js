import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function AlertDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState(null);
  const [copilotData, setCopilotData] = useState(null);

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

  async function explainWithAi() {
    const token = localStorage.getItem('sentinelai_token');
    setCopilotOpen(true);
    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotData(null);

    try {
      const res = await fetch(`${API_BASE}/api/copilot/explain/${id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setCopilotError(await res.text());
        return;
      }
      setCopilotData(await res.json());
    } catch (e) {
      setCopilotError(e.message || String(e));
    } finally {
      setCopilotLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Link href="/alerts" className="small">← Back</Link>
        <div className="row">
          <button className="btn secondary" onClick={explainWithAi}>Explain with AI</button>
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

      {copilotOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setCopilotOpen(false)}
        >
          <div
            className="card"
            style={{ width: 'min(720px, 100%)', maxHeight: '80vh', overflow: 'auto', background: 'white' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>AI SOC Copilot</strong>
              <button className="btn secondary" onClick={() => setCopilotOpen(false)}>
                Close
              </button>
            </div>

            {copilotLoading && <div className="small" style={{ marginTop: 8 }}>Generating explanation…</div>}
            {copilotError && (
              <pre className="small" style={{ whiteSpace: 'pre-wrap', color: '#b91c1c', marginTop: 8 }}>
                {copilotError}
              </pre>
            )}

            {copilotData && (
              <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                <div>
                  <div className="small"><strong>Alert Analysis</strong></div>
                  <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{copilotData.analysis}</div>
                </div>

                <div>
                  <div className="small"><strong>Evidence</strong></div>
                  {Array.isArray(copilotData.evidence) && copilotData.evidence.length ? (
                    <ul className="small" style={{ marginTop: 6 }}>
                      {copilotData.evidence.map((e, idx) => (
                        <li key={idx}>{e}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="small">No evidence provided.</div>
                  )}
                </div>

                <div>
                  <div className="small"><strong>Recommended Actions</strong></div>
                  {Array.isArray(copilotData.recommended_actions) && copilotData.recommended_actions.length ? (
                    <ol className="small" style={{ marginTop: 6 }}>
                      {copilotData.recommended_actions.map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ol>
                  ) : (
                    <div className="small">No actions provided.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
