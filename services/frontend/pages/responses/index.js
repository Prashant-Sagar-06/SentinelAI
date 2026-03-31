import { useMemo, useState } from 'react';

import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import useAuth from '../../hooks/useAuth';
import { getResponses } from '../../services/api';
import { Button, Card, Input, Table, TableSkeleton, TBody, TD, TH, THead, TR } from '../../ui';

export default function ResponsesPage() {
  const { token } = useAuth();

  const [anomalyId, setAnomalyId] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const id = anomalyId.trim();
    if (!id) {
      setItems([]);
      setError('');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await getResponses(id, { token, limit: 50 });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e?.message || 'Failed to load responses');
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  return (
    <ProtectedRoute>
      <Layout title="Responses" subtitle="Automation outcomes (requires anomaly id)" onRefresh={load} refreshing={loading}>
      {error ? <Card className="mb-4 border-soc-critical/35 bg-soc-critical/10 text-ui-sm text-soc-text">{error}</Card> : null}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-ui-base font-semibold text-soc-text">Lookup</div>
            <div className="mt-1 text-xs text-soc-muted">Enter an anomaly id to fetch executed/skipped response actions.</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input value={anomalyId} onChange={(e) => setAnomalyId(e.target.value)} placeholder="Anomaly ID (e.g. 64f0... )" />
              <Button type="button" variant="primary" className="h-10 px-5" onClick={load} disabled={loading} loading={loading}>
                Load
              </Button>
            </div>
          </div>

          <div className="text-xs text-soc-muted">Showing {rows.length} items</div>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden p-0">
        <Table minWidth={920}>
              <THead>
                <tr>
                  <TH>Timestamp</TH>
                  <TH>Action</TH>
                  <TH>Status</TH>
                  <TH>Details</TH>
                </tr>
              </THead>
              <TBody>
                {loading ? (
                  <TableSkeleton rows={6} cols={4} />
                ) : rows.length ? (
                  rows.map((r) => (
                    <TR key={r._id || `${r.action}-${r.timestamp}`}>
                      <TD>
                        {r.timestamp ? new Date(r.timestamp).toLocaleString() : r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}
                      </TD>
                      <TD className="font-mono">{r.action || r.type || '-'}</TD>
                      <TD>{r.status || '-'}</TD>
                      <TD className="text-ui-xs text-soc-muted">{r.message || r.details || '-'}</TD>
                    </TR>
                  ))
                ) : (
                  <tr>
                    <TD className="py-6 text-soc-muted" colSpan={4}>
                      Enter an anomaly id to view responses.
                    </TD>
                  </tr>
                )}
              </TBody>
            </Table>
      </Card>
      </Layout>
    </ProtectedRoute>
  );
}
