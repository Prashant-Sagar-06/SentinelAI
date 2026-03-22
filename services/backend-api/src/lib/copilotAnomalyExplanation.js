function clamp01(x) {
  if (typeof x !== 'number' || Number.isNaN(x) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function zScore(x, mu, sigma) {
  const eps = 1e-6;
  const nX = typeof x === 'number' ? x : Number(x ?? 0);
  const nMu = typeof mu === 'number' ? mu : Number(mu ?? 0);
  const nSigma = typeof sigma === 'number' ? sigma : Number(sigma ?? 0);
  return (nX - nMu) / (nSigma + eps);
}

function fmtPct(x) {
  const n = typeof x === 'number' ? x : Number(x ?? 0);
  return `${Math.round(clamp01(n) * 100)}%`;
}

function fmtMs(x) {
  const n = typeof x === 'number' ? x : Number(x ?? 0);
  return `${Math.round(Math.max(0, n))}ms`;
}

function baselineFromAnomaly(anomaly) {
  const b = anomaly?.metadata?.baseline;
  if (!b || typeof b !== 'object') return null;

  const requests = b.requests;
  const latency = b.latency;
  const error_rate = b.error_rate;
  const unique_ips = b.unique_ips;

  const ok = (v) => v && typeof v.mean === 'number' && typeof v.std === 'number';
  if (!ok(requests) || !ok(latency) || !ok(error_rate) || !ok(unique_ips)) return null;

  return {
    requests,
    latency,
    error_rate,
    unique_ips,
    source: typeof b.source === 'string' ? b.source : null,
  };
}

export function generateExplanation(metrics, anomaly) {
  const requests = Number(metrics?.requests ?? 0);
  const errorRate = Number(metrics?.error_rate ?? 0);
  const avgLatency = Number(metrics?.avg_latency ?? 0);
  const uniqueIps = Number(metrics?.unique_ips ?? 0);

  const baseline = baselineFromAnomaly(anomaly);

  const highErrorRate = errorRate > 0.5;
  const highLatency = avgLatency > 100;

  const reqZ = baseline ? zScore(requests, baseline.requests.mean, baseline.requests.std) : null;
  const ipsZ = baseline ? zScore(uniqueIps, baseline.unique_ips.mean, baseline.unique_ips.std) : null;

  // "Requests spike" uses baseline z-score when available, otherwise a conservative absolute heuristic.
  const trafficSurge = baseline ? reqZ >= 3 : requests >= 1000;

  // Unique IP surge can indicate distributed traffic (bots/scans) when paired with request spike.
  const ipSurge = baseline ? ipsZ >= 3 : uniqueIps >= 250;

  const summaryBits = [];
  if (highErrorRate) summaryBits.push('high error rate');
  if (highLatency) summaryBits.push('latency spike');
  if (trafficSurge) summaryBits.push('traffic surge');
  if (ipSurge) summaryBits.push('unique IP surge');

  const summary = summaryBits.length
    ? `${summaryBits.map((s) => s[0].toUpperCase() + s.slice(1)).join(' and ')} detected in the last minute.`
    : 'Anomalous behavior detected in the last minute.';

  const reasonBits = [];
  if (highErrorRate) {
    reasonBits.push(`Error rate is ${fmtPct(errorRate)}, suggesting the system is experiencing failures.`);
  }
  if (highLatency) {
    reasonBits.push(`Average latency is ${fmtMs(avgLatency)}, indicating performance degradation.`);
  }
  if (trafficSurge) {
    if (baseline && typeof reqZ === 'number') {
      reasonBits.push(
        `Requests volume (${requests}) is significantly above baseline (z=${Math.round(reqZ * 100) / 100}).`
      );
    } else {
      reasonBits.push(`Requests volume (${requests}) is unusually high, consistent with a traffic surge.`);
    }
  }
  if (ipSurge) {
    if (baseline && typeof ipsZ === 'number') {
      reasonBits.push(
        `Unique IPs (${uniqueIps}) are significantly above baseline (z=${Math.round(ipsZ * 100) / 100}).`
      );
    } else {
      reasonBits.push(`Unique IPs (${uniqueIps}) are unusually high, which can indicate distributed traffic.`);
    }
  }

  if (!reasonBits.length) {
    reasonBits.push('The current minute deviates from expected behavior based on the detected anomaly score/severity.');
  }

  const reason = reasonBits.join(' ');

  const impactBits = [];
  if (highErrorRate) impactBits.push('users may experience failed requests (e.g., login failures, API errors)');
  if (highLatency) impactBits.push('end-to-end response times may be noticeably slower');
  if (trafficSurge) impactBits.push('infrastructure may see increased load and resource contention');
  if (ipSurge && trafficSurge) impactBits.push('pattern may reflect bot traffic, scanning, or a volumetric attack');

  const impact = impactBits.length
    ? `Potential impact: ${impactBits.join('; ')}.`
    : 'Potential impact: service reliability and performance may be degraded.';

  const recs = [];
  recs.push('Investigate application and ingress logs for error spikes and slow endpoints around the anomaly minute.');
  if (highErrorRate) recs.push('Check downstream dependencies (DB, cache, third-party APIs) for failures/timeouts.');
  if (highLatency) recs.push('Inspect recent deploys/config changes and system health (CPU/memory/GC) for regressions.');
  if (trafficSurge) recs.push('Verify autoscaling and rate limits; consider temporarily scaling capacity if legitimate traffic.');
  if (ipSurge) recs.push('Review top source IPs/ASNs; block or rate-limit suspicious sources at WAF/edge if needed.');

  const recommendation = recs.join(' ');

  const confidence = clamp01(
    typeof anomaly?.score === 'number' ? anomaly.score : summaryBits.length ? 0.6 : 0.5
  );

  return {
    summary,
    reason,
    root_cause: reason,
    impact,
    recommendation,
    confidence,
  };
}
