import { Fragment, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import useAuth from '../../hooks/useAuth';
import { Button, ButtonLink, Card, CardHeader, Select, SeverityBadge, Table, TableSkeleton, TBody, TD, TH, THead, TR, cn } from '../../ui';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not defined');
}

function sevTone(sev) {
  const s = String(sev ?? '').toLowerCase();
  if (s === 'critical') return { row: 'bg-soc-critical/4' };
  if (s === 'high') return { row: 'bg-soc-critical/3' };
  if (s === 'medium') return { row: 'bg-soc-warning/3' };
  if (s === 'low') return { row: 'bg-soc-success/3' };
  return { row: '' };
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fmtTime(v) {
  const d = toDate(v);
  if (!d) return '-';
  return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: '2-digit' });
}

export default function Alerts() {
  const { token } = useAuth();

  const [items, setItems] = useState([]);
  const [expandedId, setExpandedId] = useState('');
  const [severity, setSeverity] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(limit = 50) {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE}/api/alerts?limit=${encodeURIComponent(limit)}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => 'Failed to load alerts');
        throw new Error(txt);
      }
      const json = await res.json().catch(() => ({}));
      const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e?.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load(75);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch(`${API_BASE}/api/alerts?limit=75`, {
          headers: { authorization: `Bearer ${token}` },
        });

        const json = await res.json().catch(() => ({}));
        const data = json && typeof json === 'object' && 'data' in json ? json.data : json;

        if (res.ok && !cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
        }
      } catch {
        // best-effort
      }
    }

    const socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket'], // ✅ force websocket
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 5000,
    });

    /* =========================
       CONNECTION DEBUG
    ========================= */

    socket.on('connect', () => {
      console.log('🔌 Alerts socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.warn('❌ Alerts socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Alerts socket error:', err.message);
    });

    /* =========================
       REALTIME HANDLER
    ========================= */

    const handleAlert = () => {
      refresh();
    };

    socket.on('alert_created', handleAlert);

    /* =========================
       CLEANUP (CRITICAL)
    ========================= */

    return () => {
      cancelled = true;
      socket.off('alert_created', handleAlert);
      socket.disconnect();
    };
  }, [token]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const windowMs =
      timeRange === '1h'
        ? 60 * 60 * 1000
        : timeRange === '24h'
          ? 24 * 60 * 60 * 1000
          : timeRange === '7d'
            ? 7 * 24 * 60 * 60 * 1000
            : Infinity;

    return (Array.isArray(items) ? items : [])
      .filter((a) => (severity === 'all' ? true : String(a?.severity ?? '').toLowerCase() === severity))
      .filter((a) => {
        if (windowMs === Infinity) return true;
        const dt = toDate(a?.createdAt) || toDate(a?.first_seen) || toDate(a?.window_start);
        if (!dt) return true;
        return now - dt.getTime() <= windowMs;
      });
  }, [items, severity, timeRange]);

  return (
    <ProtectedRoute>
      <Layout
      title="Alerts"
      subtitle="Triage queue with realtime updates"
      onRefresh={() => load(75)}
      refreshing={loading}
      rightSlot={
        <div className="hidden items-center gap-2 sm:flex">
          <Select className="w-[160px]" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="all">All severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select className="w-[140px]" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="1h">Last 1h</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7d</option>
            <option value="all">All time</option>
          </Select>
        </div>
      }
      >
      {error ? <Card className="border-soc-critical/35 bg-soc-critical/10 text-ui-sm text-soc-text">{error}</Card> : null}

      <Card className="mt-4 overflow-hidden p-0">
        <div className="border-b border-soc-border px-4 py-3">
          <CardHeader
            title="Alert Stream"
            right={<span className="text-ui-xs text-soc-muted">Showing {filtered.length} items</span>}
            className="mb-0"
          />
        </div>

        <Table minWidth={920}>
              <THead>
                <tr>
                  <TH>Title</TH>
                  <TH>Severity</TH>
                  <TH>Type</TH>
                  <TH>Status</TH>
                  <TH>Last Seen</TH>
                  <TH />
                </tr>
              </THead>
              <TBody>
                {loading ? (
                  <TableSkeleton rows={8} cols={6} />
                ) : filtered.length ? (
                  filtered.map((a) => {
                    const t = sevTone(a?.severity);
                    const isExpanded = expandedId && String(a?._id) === String(expandedId);
                    return (
                      <Fragment key={a._id}>
                        <TR className={cn(t.row)}>
                          <TD>
                            <div className="truncate font-semibold text-soc-text">{a.title}</div>
                            <div className="mt-1 truncate text-ui-xs text-soc-muted">{a.reason}</div>
                          </TD>
                          <TD>
                            <SeverityBadge severity={a.severity} />
                          </TD>
                          <TD className="text-soc-muted">{a.type || a.threat_type || '-'}</TD>
                          <TD className="text-soc-muted">{a.status || '-'}</TD>
                          <TD className="text-soc-muted">{fmtTime(a.last_seen ?? a.updatedAt ?? a.createdAt)}</TD>
                          <TD className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setExpandedId((cur) => (cur && cur === a._id ? '' : String(a._id)))}
                              >
                                {isExpanded ? 'Collapse' : 'Expand'}
                              </Button>
                              <ButtonLink href={`/alerts/${a._id}`} variant="primary" size="sm">
                                Investigate
                              </ButtonLink>
                            </div>
                          </TD>
                        </TR>

                        {isExpanded ? (
                          <TR className="bg-black/10 hover:bg-black/10">
                            <TD colSpan={6} className="py-4">
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <Card className="bg-black/10 p-3 shadow-none" padding="md">
                                  <div className="text-ui-xs font-semibold text-soc-muted">Source IP</div>
                                  <div className="mt-1 font-mono text-ui-base text-soc-text">{a.source_ip || '-'}</div>
                                </Card>
                                <Card className="bg-black/10 p-3 shadow-none" padding="md">
                                  <div className="text-ui-xs font-semibold text-soc-muted">Actor</div>
                                  <div className="mt-1 text-ui-base text-soc-text">{a.actor || '-'}</div>
                                </Card>
                                <Card className="bg-black/10 p-3 shadow-none" padding="md">
                                  <div className="text-ui-xs font-semibold text-soc-muted">Events</div>
                                  <div className="mt-1 text-ui-base text-soc-text">{a.event_count ?? a.counts?.occurrences ?? 1}</div>
                                </Card>
                                <Card className="bg-black/10 p-3 shadow-none" padding="md">
                                  <div className="text-ui-xs font-semibold text-soc-muted">First Seen</div>
                                  <div className="mt-1 text-ui-base text-soc-text">{fmtTime(a.first_seen ?? a.createdAt)}</div>
                                </Card>
                              </div>
                            </TD>
                          </TR>
                        ) : null}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <TD className="py-8 text-soc-muted" colSpan={6}>
                      No alerts match the current filters.
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
