import { Activity, Lightbulb, Percent, ShieldAlert, Target, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { getAnomalyExplanation } from '../services/api';
import { Badge, Button, Card, CardMuted, Modal, ModalPanel, Skeleton } from '../ui';
import MetricsChart from './MetricsChart';
import ResponsePanel from './ResponsePanel';

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export default function AnomalyDetailModal({ token, anomalyId, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    if (!open || !anomalyId) return undefined;

    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError('');
        setPayload(null);
        const json = await getAnomalyExplanation(anomalyId, { token, signal: controller.signal });
        setPayload(json);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setError(e?.message || 'Failed to load anomaly explanation');
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [open, token, anomalyId]);

  const explanation = payload?.explanation || payload?.analysis || null;
  const metrics = payload?.metrics || null;

  const confidence = useMemo(() => {
    const v = explanation?.confidence ?? payload?.confidence;
    return clamp01(v);
  }, [explanation, payload]);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalPanel>
        <Card padding="lg">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-soc-muted">
                    <ShieldAlert className="h-4 w-4" />
                    <span>SentinelAI Copilot</span>
                  </div>
                  <div className="mt-1 truncate text-lg font-semibold text-soc-text">Anomaly Investigation</div>
                  <div className="mt-0.5 truncate text-[11px] text-soc-muted">ID: {anomalyId || '-'}</div>
                </div>

                <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close modal">
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </div>

              <div className="mt-4 grid gap-4">
                {loading ? (
                  <CardMuted>
                    <div className="flex items-center gap-2 text-sm text-soc-muted">
                      <Activity className="h-4 w-4" />
                      Loading explanation…
                    </div>
                    <div className="mt-3 grid gap-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  </CardMuted>
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-soc-critical/35 bg-soc-critical/10 px-4 py-3 text-sm text-soc-text">
                    <div className="text-xs font-semibold text-soc-critical">Error</div>
                    <div className="mt-1 text-xs text-soc-muted">{error}</div>
                  </div>
                ) : null}

                {!loading && payload ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <div className="grid gap-4">
                        <CardMuted>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-soc-text">Summary</div>
                            <Badge tone="info">
                              <Percent className="h-3.5 w-3.5" />
                              {Math.round(confidence * 100)}%
                            </Badge>
                          </div>
                          <div className="mt-2 text-sm text-soc-text">{explanation?.summary || '-'}</div>

                          <div className="mt-4">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-semibold text-soc-muted">Confidence</div>
                              <div className="text-xs text-soc-muted">{Math.round(confidence * 100)}%</div>
                            </div>
                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
                              <div
                                className="h-full rounded-full bg-soc-info transition-all"
                                style={{ width: `${Math.round(confidence * 100)}%` }}
                              />
                            </div>
                          </div>
                        </CardMuted>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <CardMuted>
                            <div className="flex items-center gap-2 text-xs font-semibold text-soc-muted">
                              <Target className="h-4 w-4" />
                              Root Cause
                            </div>
                            <div className="mt-2 text-sm text-soc-text">{explanation?.root_cause || explanation?.reason || '-'}</div>
                          </CardMuted>

                          <CardMuted>
                            <div className="flex items-center gap-2 text-xs font-semibold text-soc-muted">
                              <Activity className="h-4 w-4" />
                              Impact
                            </div>
                            <div className="mt-2 text-sm text-soc-text">{explanation?.impact || '-'}</div>
                          </CardMuted>
                        </div>

                        <CardMuted>
                          <div className="flex items-center gap-2 text-xs font-semibold text-soc-muted">
                            <Lightbulb className="h-4 w-4" />
                            Recommendation
                          </div>
                          <div className="mt-2 text-sm text-soc-text">{explanation?.recommendation || '-'}</div>
                        </CardMuted>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <MetricsChart metrics={metrics} />
                      <ResponsePanel token={token} anomalyId={anomalyId} />
                    </div>
                  </div>
                ) : null}
              </div>
        </Card>
      </ModalPanel>
    </Modal>
  );
}
