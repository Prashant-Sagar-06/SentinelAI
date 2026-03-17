from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.threat_intel import classify_source_ip


def test_classify_source_ip_matches_known_bad_ip():
    intel = classify_source_ip("185.23.12.58")
    assert intel is not None
    assert intel.threat_type == "malicious_ip_activity"
    assert intel.risk_level == "high"
    assert intel.risk_score == 0.9


def test_analyze_malicious_ip_overrides_classification_without_breaking_schema():
    client = TestClient(app)
    payload = {
        "event": {
            "timestamp": "2026-03-17T10:20:00Z",
            "source": "auth-service",
            "event_type": "login_attempt",
            "status": "failed",
            "ingest_id": "evt_123",
            "actor": {"user": "admin"},
            "network": {"ip": "185.23.12.58", "user_agent": "pytest"},
            "attributes": {"attempts": 120},
            "tags": ["unit-test"],
        }
    }

    res = client.post("/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()

    # required response fields
    assert data["event_id"] == "evt_123"
    assert data["model_version"]
    assert 0.0 <= float(data["anomaly_score"]) <= 1.0
    assert float(data["risk_score"]) == 0.9
    assert data["risk_level"] == "high"
    assert data["threat_type"] == "malicious_ip_activity"
    assert "Source IP matches known malicious IP list" in data["explanations"][0]


def test_analyze_non_malicious_ip_preserves_existing_bruteforce_detection():
    client = TestClient(app)
    payload = {
        "event": {
            "timestamp": "2026-03-17T10:20:00Z",
            "source": "auth-service",
            "event_type": "login_attempt",
            "status": "failed",
            "ingest_id": "evt_456",
            "actor": {"user": "admin"},
            "network": {"ip": "203.0.113.10", "user_agent": "pytest"},
            "attributes": {"attempts": 120},
            "tags": ["unit-test"],
        }
    }

    res = client.post("/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["event_id"] == "evt_456"
    assert data["threat_type"] == "brute_force_login"
    assert data["risk_level"] == "critical"  # heuristic scoring for 120 attempts
    assert float(data["risk_score"]) >= 0.85
