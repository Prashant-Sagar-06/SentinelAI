import { useEffect, useMemo, useState } from 'react';

import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import useAuth from '../../hooks/useAuth';
import { Button, ButtonLink, Card, CardHeader, SeverityBadge, Table, TableSkeleton, TBody, TD, TH, THead, TR } from '../../ui';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not defined');
}

export default function IncidentsPage() {
  const { token } = useAuth();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextPage = page) {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await fetch(
        `${API_BASE}/api/incidents?page=${encodeURIComponent(nextPage)}&limit=${encodeURIComponent(limit)}`,
        { headers: { authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => 'Failed to load incidents');
        throw new Error(txt);
      }
      const json = await res.json().catch(() => ({}));
      const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
      setItems(Array.isArray(data.incidents) ? data.incidents : []);
      setTotal(Number(data.total ?? 0));
    } catch (e) {
      setError(e?.message || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, limit]);

  const canPrev = page > 1;
  const canNext = page * limit < total;

  const rows = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  return (
    <ProtectedRoute>
      <Layout
      title="Incidents"
      subtitle="Grouped investigations"
      onRefresh={() => load(page)}
      refreshing={loading}
      rightSlot={
        <div className="hidden items-center gap-2 sm:flex">
          <Button type="button" variant="ghost" size="sm" disabled={!canPrev || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={!canNext || loading} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
        }
      >
      {error ? <Card className="mb-4 border-soc-critical/35 bg-soc-critical/10 text-ui-sm text-soc-text">{error}</Card> : null}

      <Card className="overflow-hidden p-0">
            <div className="border-b border-soc-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <CardHeader title="Incident Queue" subtitle={`Page ${page} · Total ${total}`} className="mb-0" />
                <div className="flex items-center gap-2 sm:hidden">
                  <Button type="button" variant="ghost" size="sm" disabled={!canPrev || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={!canNext || loading} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </div>

            <Table minWidth={920}>
              <THead>
                <tr>
                  <TH>Title</TH>
                  <TH>Severity</TH>
                  <TH>Status</TH>
                  <TH>Last Seen</TH>
                  <TH>Alerts</TH>
                  <TH />
                </tr>
              </THead>
              <TBody>
                {loading ? (
                  <TableSkeleton rows={8} cols={6} />
                ) : rows.length ? (
                  rows.map((it) => (
                    <TR key={it._id}>
                      <TD>
                        <div className="truncate font-semibold text-soc-text">{it.title || it.group_key || 'Incident'}</div>
                        {it.reason ? <div className="mt-1 truncate text-ui-xs text-soc-muted">{it.reason}</div> : null}
                      </TD>
                      <TD>
                        <SeverityBadge severity={it.severity} />
                      </TD>
                      <TD>{it.status || '-'}</TD>
                      <TD>
                        {it.last_seen ? new Date(it.last_seen).toLocaleString() : it.createdAt ? new Date(it.createdAt).toLocaleString() : '-'}
                      </TD>
                      <TD>{Number(it.alert_count ?? it.event_count ?? 0) || '-'}</TD>
                      <TD className="text-right">
                        <ButtonLink href={`/incidents/${encodeURIComponent(it._id)}`} variant="ghost" size="sm">
                          View
                        </ButtonLink>
                      </TD>
                    </TR>
                  ))
                ) : (
                  <tr>
                    <TD className="py-6 text-soc-muted" colSpan={6}>
                      No incidents.
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
