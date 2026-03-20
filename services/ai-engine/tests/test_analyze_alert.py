from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_analyze_alert_returns_expected_shape_and_threat_intel():
    client = TestClient(app)

    payload = {
        "alert": {
            "alert_id": "a1",
            "title": "Suspicious activity detected",
            "type": "SUSPICIOUS_IP",
            "threat_type": "malicious_ip_activity",
            "severity": "high",
            "status": "open",
            "reason": "Source IP flagged by threat intel",
            "source_ip": "185.23.12.58",
            "actor": "admin",
            "event_count": 12,
            "explanations": ["Multiple failed login attempts"],
            "metadata": {"window_seconds": 60},
        },
        "anomaly": {
            "type": "PERF_ANOMALY",
            "score": 0.91,
            "severity": "high",
            "message": "Error spike",
            "reason": "Error rate deviated significantly from baseline",
        },
    }

    res = client.post("/analyze-alert", json=payload)
    assert res.status_code == 200

    data = res.json()
    assert isinstance(data.get("analysis"), str)
    assert isinstance(data.get("evidence"), list)
    assert isinstance(data.get("recommended_actions"), list)

    # Threat intel should be present for a known bad IP.
    intel = data.get("threat_intel")
    assert intel is not None
    assert intel.get("threat_type") == "malicious_ip_activity"
    assert intel.get("risk_level") == "high"

    # Evidence should mention Source IP.
    assert any("Source IP" in str(x) for x in data.get("evidence", []))
