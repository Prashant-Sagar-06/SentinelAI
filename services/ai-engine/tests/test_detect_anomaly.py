from __future__ import annotations

from fastapi.testclient import TestClient

from app.anomaly import RollingAnomalyDetector
from app.main import app
import app.anomaly as anomaly_module


def test_detect_anomaly_returns_insufficient_data_when_baseline_too_small():
    # Reset the in-memory global detector to avoid cross-test contamination.
    anomaly_module._detector = RollingAnomalyDetector(window_size=180)

    client = TestClient(app)

    res = client.post(
        "/detect-anomaly",
        json={
            "requests_per_minute": 120.0,
            "avg_latency": 0.25,
            "error_rate": 0.01,
            "unique_ips": 5.0,
        },
    )

    assert res.status_code == 200
    data = res.json()

    assert data["anomaly"] is False
    assert data["reason"] == "Insufficient data for reliable anomaly detection"
    assert data["score"] == 0.0
