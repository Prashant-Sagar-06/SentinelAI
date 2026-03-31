import { useEffect, useState } from 'react';

import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import useAuth from '../../hooks/useAuth';
import { Button, Card, CardHeader, Table, TableSkeleton, TBody, TD, TH, THead, TR } from '../../ui';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not defined');
}

async function fetchLogs({ token, page, limit }) {
  const res = await fetch(`${API_BASE}/api/logs?page=${page}&limit=${limit}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const json = await res.json();
  const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
  return data;
}

export default function LogsExplorer() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLogs({ token, page, limit });
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total ?? 0));
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, limit]);

  const canPrev = page > 1;
  const canNext = page * limit < total;

  function fmtTs(v) {
    if (!v) return '-';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  }

  return (
    <ProtectedRoute>
      <Layout title="Logs Explorer" subtitle="Raw event telemetry" onRefresh={load} refreshing={loading}>
      {error ? <Card className="mb-4 border-soc-critical/35 bg-soc-critical/10 text-ui-sm text-soc-text">{error}</Card> : null}

      <Card className="overflow-hidden p-0">
            <div className="border-b border-soc-border px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardHeader
                  title="Event Stream"
                  subtitle={`Page ${page} · Total ${total}`}
                  className="mb-0"
                />
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" disabled={!canPrev || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={!canNext || loading} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </div>

            <Table minWidth={1040}>
              <THead>
                <tr>
                  <TH>Timestamp</TH>
                  <TH>Source</TH>
                  <TH>Event Type</TH>
                  <TH>Actor</TH>
                  <TH>IP</TH>
                  <TH>Attributes</TH>
                </tr>
              </THead>
              <TBody>
                {loading ? (
                  <TableSkeleton rows={10} cols={6} />
                ) : items.length ? (
                  items.map((l) => (
                    <TR key={l._id}>
                      <TD className="whitespace-nowrap">{fmtTs(l.timestamp)}</TD>
                      <TD>{l.source || '-'}</TD>
                      <TD className="font-mono">{l.event_type || '-'}</TD>
                      <TD>{l.actor?.user || l.actor?.service || '-'}</TD>
                      <TD className="font-mono">{l.network?.ip || '-'}</TD>
                      <TD>
                        <pre className="max-w-[520px] whitespace-pre-wrap break-words text-ui-xs text-soc-text/90">
                          {JSON.stringify(l.attributes || {}, null, 2)}
                        </pre>
                      </TD>
                    </TR>
                  ))
                ) : (
                  <tr>
                    <TD className="py-6 text-soc-muted" colSpan={6}>
                      No logs available.
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
