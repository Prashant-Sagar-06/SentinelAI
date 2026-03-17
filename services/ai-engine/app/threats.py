from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class ThreatAssessment:
    threat_type: str
    risk_score: float
    explanations: List[str]
    features: Dict[str, Any]


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _risk_level(score: float) -> str:
    if score >= 0.8:
        return "critical"
    if score >= 0.6:
        return "high"
    if score >= 0.3:
        return "medium"
    return "low"


def assess_threat(
    *,
    timestamp: datetime,
    source: str,
    event_type: str,
    status: Optional[str],
    actor_user: Optional[str],
    actor_service: Optional[str],
    source_ip: Optional[str],
    attributes: Dict[str, Any],
) -> ThreatAssessment:
    et = event_type.lower()
    st = (status or "").lower()

    explanations: List[str] = []
    features: Dict[str, Any] = {}

    # Feature helpers
    hour = timestamp.hour
    is_off_hours = hour < 6 or hour >= 22
    features["hour"] = hour
    features["off_hours"] = is_off_hours

    attempts = attributes.get("attempts")
    if isinstance(attempts, (int, float)):
        features["attempts"] = float(attempts)

    request_rate = attributes.get("request_rate")
    if isinstance(request_rate, (int, float)):
        features["request_rate"] = float(request_rate)

    # Heuristic threat classification + base risk
    threat_type = "unknown"
    score = 0.05

    # Brute force: repeated failed login attempts
    if "login" in et and st == "failed":
        threat_type = "brute_force_login"
        score = 0.65
        explanations.append("Login attempt failed")
        if isinstance(attempts, (int, float)) and attempts >= 20:
            score = max(score, 0.85)
            explanations.append(f"High failed-login attempts: {int(attempts)}")
        if source_ip:
            explanations.append("Source IP present")
        if is_off_hours:
            score = max(score, 0.75)
            explanations.append("Activity outside normal hours")

    # Suspicious API traffic: abnormal request rate
    if "api" in et and isinstance(request_rate, (int, float)) and request_rate >= 1000:
        threat_type = "suspicious_api_traffic"
        score = max(score, 0.7)
        explanations.append(f"High request rate: {int(request_rate)}/min")
        if is_off_hours:
            score = max(score, 0.78)
            explanations.append("Traffic spike outside normal hours")

    # Privilege escalation: role/admin changes
    if "privilege" in et or "role_change" in et or "admin" in et:
        threat_type = "privilege_escalation"
        score = max(score, 0.7)
        explanations.append("Privilege-related event type")
        if actor_user:
            explanations.append(f"Actor user: {actor_user}")

    # Exfiltration: large outbound bytes
    bytes_out = attributes.get("bytes_out")
    if isinstance(bytes_out, (int, float)) and bytes_out >= 50_000_000:
        threat_type = "exfiltration"
        score = max(score, 0.8)
        explanations.append(f"Large outbound data volume: {int(bytes_out)} bytes")

    if source_ip and threat_type != "unknown":
        features["source_ip_present"] = True

    if not explanations:
        explanations.append("No strong threat signature; baseline scoring applied")

    score = _clamp01(score)
    features["risk_level"] = _risk_level(score)

    return ThreatAssessment(
        threat_type=threat_type,
        risk_score=score,
        explanations=explanations,
        features=features,
    )
