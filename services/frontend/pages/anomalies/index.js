import { useEffect, useState } from 'react';

import AnomalyDetailModal from '../../components/AnomalyDetailModal';
import AnomalyList from '../../components/AnomalyList';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import useAuth from '../../hooks/useAuth';
import { Card } from '../../ui';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not defined');
}

export default function AnomaliesPage() {
  const { token } = useAuth();

  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(limit = 50) {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE}/api/anomalies?limit=${encodeURIComponent(limit)}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => 'Failed to load anomalies');
        throw new Error(txt);
      }
      const json = await res.json().catch(() => ({}));
      const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e?.message || 'Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load(75);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <ProtectedRoute>
      <Layout
        title="Anomalies"
        subtitle="AI-detected anomalies"
        onRefresh={() => load(75)}
        refreshing={loading}
      >
      {error ? <Card className="mb-4 border-soc-critical/35 bg-soc-critical/10 text-ui-sm text-soc-text">{error}</Card> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AnomalyList
            anomalies={items}
            selectedId={selectedId}
            onSelect={(a) => setSelectedId(String(a?._id || ''))}
            loading={loading}
            error={error}
          />
        </div>

        <Card>
          <div className="text-ui-base font-semibold text-soc-text">Investigation</div>
          <div className="mt-2 text-sm text-soc-muted">Select an anomaly to open the Copilot investigation panel.</div>
          <div className="mt-3 rounded-control border border-soc-border bg-black/10 px-3 py-2 text-xs text-soc-muted">
            Tip: Use Refresh to pull the latest anomalies.
          </div>
        </Card>
      </div>

      <AnomalyDetailModal token={token} anomalyId={selectedId} open={Boolean(selectedId)} onClose={() => setSelectedId('')} />
      </Layout>
    </ProtectedRoute>
  );
}
