import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import useAuth from '../../hooks/useAuth';
import { ButtonLink, Card, CardHeader, SeverityBadge, Table, TableSkeleton, TBody, TD, TH, THead, TR } from '../../ui';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not defined');
}

export default function IncidentDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const { token } = useAuth();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!token || !id) return;
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
      if (!res.ok) {
        const msg = (data && data?.error?.message) || (typeof data === 'string' ? data : 'Failed to load incident');
        throw new Error(msg);
      }
      setIncident(data.incident || null);
    } catch (e) {
      setError(e?.message || 'Failed to load incident');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token || !id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const alerts = useMemo(() => {
    const list = incident?.alerts;
    return Array.isArray(list) ? list : [];
  }, [incident?.alerts]);

  const title = incident?.title || incident?.group_key || 'Incident';

  return (
    <ProtectedRoute>
      <Layout
      title="Incident"
      subtitle={
        incident
          ? `${String(incident?.status || 'unknown').toUpperCase()} · ${String(incident?.severity || 'unknown').toUpperCase()}`
          : 'Loading incident'
      }
      onRefresh={load}
      refreshing={loading}
      rightSlot={
        <ButtonLink href="/incidents" variant="ghost" size="sm">
          Back
        </ButtonLink>
      }
    >
      {error ? <Card className="mb-4 border-soc-critical/35 bg-soc-critical/10 text-ui-sm text-soc-text">{error}</Card> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-soc-muted">Incident</div>
                  <div className="mt-1 truncate text-lg font-semibold text-soc-text">{loading ? 'Loading…' : title}</div>
                  <div className="mt-1 text-[11px] text-soc-muted">ID: {id || '-'}</div>
                </div>
                {incident ? <SeverityBadge severity={incident.severity} /> : null}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-control border border-soc-border bg-black/10 px-3 py-2">
                  <div className="text-xs text-soc-muted">Status</div>
                  <div className="mt-0.5 text-sm text-soc-text">{incident?.status || '-'}</div>
                </div>
                <div className="rounded-control border border-soc-border bg-black/10 px-3 py-2">
                  <div className="text-xs text-soc-muted">Assigned To</div>
                  <div className="mt-0.5 text-sm text-soc-text">{incident?.assigned_to || 'Unassigned'}</div>
                </div>
                <div className="rounded-control border border-soc-border bg-black/10 px-3 py-2">
                  <div className="text-xs text-soc-muted">Created</div>
                  <div className="mt-0.5 text-sm text-soc-text">
                    {incident?.createdAt ? new Date(incident.createdAt).toLocaleString() : '-'}
                  </div>
                </div>
                <div className="rounded-control border border-soc-border bg-black/10 px-3 py-2">
                  <div className="text-xs text-soc-muted">Last Seen</div>
                  <div className="mt-0.5 text-sm text-soc-text">
                    {incident?.last_seen ? new Date(incident.last_seen).toLocaleString() : '-'}
                  </div>
                </div>
              </div>

              {incident?.notes ? (
                <div className="mt-3 rounded-control border border-soc-border bg-black/10 px-3 py-2">
                  <div className="text-xs text-soc-muted">Notes</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-soc-text">{incident.notes}</div>
                </div>
              ) : null}
        </Card>

        <Card>
          <div className="text-ui-base font-semibold text-soc-text">Linked Alerts</div>
          <div className="mt-1 text-xs text-soc-muted">Alerts grouped into this incident</div>
          <div className="mt-3 rounded-control border border-soc-border bg-black/10 px-3 py-2 text-xs text-soc-muted">{alerts.length} alerts</div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden p-0">
            <div className="border-b border-soc-border px-4 py-3">
              <CardHeader title="Alerts" right={<span className="text-ui-xs text-soc-muted">Newest first</span>} className="mb-0" />
            </div>

            <Table minWidth={920}>
              <THead>
                <tr>
                  <TH>Title</TH>
                  <TH>Severity</TH>
                  <TH>Status</TH>
                  <TH>Last Seen</TH>
                  <TH />
                </tr>
              </THead>
              <TBody>
                {loading ? (
                  <TableSkeleton rows={6} cols={5} />
                ) : alerts.length ? (
                  alerts.map((a) => (
                    <TR key={a._id}>
                      <TD>
                        <div className="truncate font-semibold text-soc-text">{a.title || 'Alert'}</div>
                        {a.reason ? <div className="mt-1 truncate text-ui-xs text-soc-muted">{a.reason}</div> : null}
                      </TD>
                      <TD>
                        <SeverityBadge severity={a.severity} />
                      </TD>
                      <TD>{a.status || '-'}</TD>
                      <TD>
                        {a.last_seen
                          ? new Date(a.last_seen).toLocaleString()
                          : a.createdAt
                            ? new Date(a.createdAt).toLocaleString()
                            : '-'}
                      </TD>
                      <TD className="text-right">
                        <ButtonLink href={`/alerts/${encodeURIComponent(a._id)}`} variant="primary" size="sm">
                          Investigate
                        </ButtonLink>
                      </TD>
                    </TR>
                  ))
                ) : (
                  <tr>
                    <TD className="py-6 text-soc-muted" colSpan={5}>
                      No alerts linked.
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
