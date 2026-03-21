from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from threading import Lock
from typing import Deque, Dict, List, Tuple

import numpy as np
from sklearn.ensemble import IsolationForest


@dataclass
class AnomalyResult:
    anomaly: bool
    score: float
    reason: str
    confidence: float = 0.0


def _clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def _z_score(x: float, mu: float, sigma: float, eps: float = 1e-6) -> float:
    return float((x - mu) / (sigma + eps))


class RollingAnomalyDetector:
    """Keeps a rolling window of metric vectors and runs:

    - Statistical z-score checks: anomaly if any metric z >= 3
    - Simple ML: IsolationForest over the last N points

    This is intentionally lightweight and stateful (in-memory)."""

    def __init__(self, window_size: int = 180):
        # 180 points at 10s interval ~= 30 minutes; worker window is 15 minutes.
        self._window_size = int(window_size)
        self._lock = Lock()
        self._history: Deque[Tuple[float, float, float, float]] = deque(maxlen=self._window_size)
        self._iforest: IsolationForest | None = None
        self._iforest_trained_n: int = 0

    def _fit_iforest(self, X: np.ndarray) -> None:
        # A small model to avoid overfitting and keep CPU low.
        model = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42,
        )
        model.fit(X)
        self._iforest = model
        self._iforest_trained_n = int(X.shape[0])

    def _iforest_score(self, X: np.ndarray, x: np.ndarray) -> float:
        # IsolationForest.decision_function: higher => more normal.
        # We'll map to anomaly score in 0..1.
        if self._iforest is None:
            return 0.0

        decision = float(self._iforest.decision_function(x.reshape(1, -1))[0])
        # decision is roughly in [-0.5..0.5] depending on fit; map via logistic.
        score = 1.0 / (1.0 + np.exp(6.0 * decision))
        return _clamp01(float(score))

    def detect(self, *, rpm: float, avg_latency: float, error_rate: float, unique_ips: float) -> AnomalyResult:
        with self._lock:
            self._history.append((float(rpm), float(avg_latency), float(error_rate), float(unique_ips)))
            hist = list(self._history)

        total_requests = len(hist)

        if total_requests < 10:
            return AnomalyResult(
                anomaly=False,
                score=0.0,
                reason="Insufficient data for reliable anomaly detection",
                confidence=0.0,
            )

        X = np.array(hist, dtype=float)
        mu = X.mean(axis=0)
        sigma = X.std(axis=0, ddof=1) if X.shape[0] > 1 else np.zeros(4)

        x = np.array([rpm, avg_latency, error_rate, unique_ips], dtype=float)
        z = np.array([
            _z_score(float(x[i]), float(mu[i]), float(sigma[i])) for i in range(4)
        ])

        keys = ["requests_per_minute", "avg_latency", "error_rate", "unique_ips"]
        triggered: List[str] = []
        max_z = 0.0
        for i, k in enumerate(keys):
            if z[i] >= 3.0:
                triggered.append(f"{k} z={z[i]:.2f} (x={x[i]:.2f}, mean={mu[i]:.2f})")
            if z[i] > max_z:
                max_z = float(z[i])

        # Train/update IsolationForest periodically to keep stable.
        # Only refit when we have a meaningful new amount of history.
        with self._lock:
            need_fit = self._iforest is None or (len(hist) - self._iforest_trained_n) >= 20
        if need_fit and X.shape[0] >= 20:
            # Fit outside the lock.
            self._fit_iforest(X)

        if_score = self._iforest_score(X, x) if self._iforest is not None else 0.0

        # Combine scores: z-score based mapped into 0..1 plus IsolationForest.
        # z>=3 should already be meaningful; normalize roughly by 6.
        z_score_norm = _clamp01(max(0.0, max_z) / 6.0)
        score = _clamp01(max(z_score_norm, if_score))

        # Dynamic threshold: be more conservative early in the window.
        score_threshold = 0.75 if len(hist) < 30 else 0.6
        anomaly = bool(triggered) or score >= score_threshold

        if triggered:
            reason = "; ".join(triggered)
        else:
            reason = f"IsolationForest score={if_score:.3f}, z_norm={z_score_norm:.3f}"

        confidence = _clamp01(float(score))
        if triggered:
            confidence = _clamp01(max(confidence, 0.85))

        return AnomalyResult(anomaly=anomaly, score=score, reason=reason, confidence=confidence)


_detector = RollingAnomalyDetector(window_size=180)


def detect_anomaly(*, requests_per_minute: float, avg_latency: float, error_rate: float, unique_ips: float) -> Dict[str, object]:
    res = _detector.detect(
        rpm=requests_per_minute,
        avg_latency=avg_latency,
        error_rate=error_rate,
        unique_ips=unique_ips,
    )
    return {"anomaly": res.anomaly, "score": res.score, "reason": res.reason, "confidence": res.confidence}
