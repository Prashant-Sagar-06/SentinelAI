from __future__ import annotations

import logging
import os
import time
import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pythonjsonlogger import jsonlogger

from .anomaly import detect_anomaly
from .schemas import (
    AnalyzeAlertRequest,
    AnalyzeAlertResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    DetectAnomalyRequest,
    DetectAnomalyResponse,
)
from .threat_intel import classify_source_ip
from .threats import assess_threat

app = FastAPI(title="SentinelAI AI Engine", version="0.1.0")


def _require_port() -> int:
    raw = (os.getenv("PORT") or "").strip()
    if not raw:
        raise RuntimeError("Missing required env var: PORT")
    try:
        port = int(raw)
    except ValueError as e:
        raise RuntimeError("PORT must be an integer") from e
    if port <= 0 or port > 65535:
        raise RuntimeError("PORT must be in range 1-65535")
    return port


_PORT = _require_port()


def _require_cors_origin() -> str:
    raw = (os.getenv("CORS_ORIGIN") or "").strip()
    if not raw:
        raise RuntimeError("Missing required env var: CORS_ORIGIN")
    if raw == "*":
        raise RuntimeError("CORS_ORIGIN must not be '*'")
    # Must be an origin only (no path/query).
    try:
        from urllib.parse import urlparse

        parsed = urlparse(raw)
    except Exception as e:
        raise RuntimeError("CORS_ORIGIN must be a valid URL origin") from e

    if parsed.scheme != "https":
        raise RuntimeError("CORS_ORIGIN must use https://")
    if not parsed.netloc:
        raise RuntimeError("CORS_ORIGIN must include a hostname")
    if parsed.path not in ("", "/") or parsed.params or parsed.query or parsed.fragment:
        raise RuntimeError("CORS_ORIGIN must be an origin only (no path/query/hash)")

    return f"{parsed.scheme}://{parsed.netloc}"


_cors_origin = _require_cors_origin()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_VERSION = "heuristic-v1"


def _configure_logging() -> logging.Logger:
    logger = logging.getLogger("ai-engine")
    if logger.handlers:
        return logger

    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logger.setLevel(level)

    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.propagate = False
    return logger


log = _configure_logging()


@app.middleware("http")
async def request_logging_middleware(request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = int((time.perf_counter() - started) * 1000)
        log.exception(
            "request_failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": str(request.url.path),
                "duration_ms": duration_ms,
            },
        )
        raise

    duration_ms = int((time.perf_counter() - started) * 1000)
    response.headers["x-request-id"] = request_id
    log.info(
        "request_completed",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": str(request.url.path),
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response

@app.get("/health")
def health():
    log.info("health_check", extra={"model_version": MODEL_VERSION})
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    e = req.event

    actor_user = e.actor.user if e.actor else None
    actor_service = e.actor.service if e.actor else None
    source_ip = e.network.ip if e.network else None

    assessment = assess_threat(
        timestamp=e.timestamp,
        source=e.source,
        event_type=e.event_type,
        status=e.status,
        actor_user=actor_user,
        actor_service=actor_service,
        source_ip=source_ip,
        attributes=e.attributes or {},
    )

    intel = classify_source_ip(source_ip)
    if intel is not None:
        threat_type = intel.threat_type
        risk_score = float(intel.risk_score)
        risk_level = str(intel.risk_level)
        explanations = list(intel.explanations)

        features = dict(assessment.features)
        features["threat_intel_match"] = True
        if source_ip:
            features["threat_intel_ip"] = source_ip
        features["risk_level"] = risk_level

        # Preserve additional heuristic context without changing classification.
        for line in assessment.explanations:
            if line not in explanations:
                explanations.append(line)
    else:
        threat_type = assessment.threat_type
        risk_score = float(assessment.risk_score)
        risk_level = str(assessment.features.get("risk_level", "low"))
        explanations = assessment.explanations
        features = assessment.features

    # For MVP: anomaly_score tracks risk_score (placeholder for model-based anomaly)
    anomaly_score = float(risk_score)

    return AnalyzeResponse(
        event_id=e.ingest_id or "",
        model_version=MODEL_VERSION,
        anomaly_score=anomaly_score,
        risk_score=risk_score,
        risk_level=risk_level,  # type: ignore[arg-type]
        threat_type=threat_type,
        explanations=explanations,
        features=features,
    )


@app.post("/detect-anomaly", response_model=DetectAnomalyResponse)
def detect_anomaly_endpoint(req: DetectAnomalyRequest):
    result = detect_anomaly(
        requests_per_minute=float(req.requests_per_minute),
        avg_latency=float(req.avg_latency),
        error_rate=float(req.error_rate),
        unique_ips=float(req.unique_ips),
    )
    return DetectAnomalyResponse(
        anomaly=bool(result.get("anomaly")),
        score=float(result.get("score", 0.0)),
        reason=str(result.get("reason", "")),
    )


@app.post("/analyze-alert", response_model=AnalyzeAlertResponse)
def analyze_alert(req: AnalyzeAlertRequest):
    alert = req.alert
    anomaly = req.anomaly

    alert_type = (alert.type or "").strip()
    threat_type = (alert.threat_type or "").strip()
    severity = (alert.severity or "").strip().lower()
    status = (alert.status or "").strip().lower()

    source_ip = (alert.source_ip or "").strip() or None

    intel_payload = None
    intel = classify_source_ip(source_ip) if source_ip else None
    if intel is not None:
        intel_payload = {
            "threat_type": intel.threat_type,
            "risk_level": str(intel.risk_level),
            "risk_score": float(intel.risk_score),
            "explanations": list(intel.explanations),
        }

    primary = alert.title or alert.message or "Alert requires investigation."

    context_bits = []
    if alert_type:
        context_bits.append(f"type={alert_type}")
    if threat_type:
        context_bits.append(f"threat_type={threat_type}")
    if severity:
        context_bits.append(f"severity={severity}")
    if status:
        context_bits.append(f"status={status}")
    if context_bits:
        primary = f"{primary} ({', '.join(context_bits)})"

    analysis_lines = [primary]

    if intel is not None:
        analysis_lines.append(
            "Source IP matches threat intel; treat as higher confidence until disproven."
        )
    elif source_ip:
        analysis_lines.append(
            "Source IP has no known threat-intel match in the local feed; rely on observed behavior and logs."
        )

    if anomaly is not None and (anomaly.reason or anomaly.message):
        analysis_lines.append(
            f"Related anomaly context: {(anomaly.reason or anomaly.message or '').strip()}"
        )

    if alert.reason and alert.reason.strip():
        analysis_lines.append(f"Alert reason: {alert.reason.strip()}")

    evidence: list[str] = []
    for e in (alert.explanations or [])[:12]:
        if isinstance(e, str) and e.strip():
            evidence.append(e.strip())

    if intel is not None:
        for e in list(intel.explanations)[:8]:
            if isinstance(e, str) and e.strip() and e.strip() not in evidence:
                evidence.append(e.strip())

    if anomaly is not None:
        if anomaly.reason and isinstance(anomaly.reason, str) and anomaly.reason.strip():
            if anomaly.reason.strip() not in evidence:
                evidence.append(anomaly.reason.strip())

    if source_ip and not any("source ip" in x.lower() for x in evidence):
        evidence.append(f"Source IP: {source_ip}")
    if alert.actor and not any("actor" in x.lower() for x in evidence):
        evidence.append(f"Actor: {alert.actor}")

    recommended_actions: list[str] = []
    if intel is not None:
        recommended_actions.extend(
            [
                "Block or rate-limit the source IP at the edge/WAF.",
                "Search for additional activity from this IP across the environment.",
            ]
        )

    if "brute" in threat_type.lower() or "brute" in alert_type.lower():
        recommended_actions.extend(
            [
                "Review authentication logs for failed login bursts and targeted accounts.",
                "Enforce MFA and lockout/rate limits for impacted accounts.",
            ]
        )
    elif "exfil" in threat_type.lower() or "exfil" in alert_type.lower():
        recommended_actions.extend(
            [
                "Inspect data access and egress logs for unusual downloads or transfers.",
                "Temporarily restrict data export permissions for suspicious users/services.",
            ]
        )
    elif "error" in alert_type.lower() or "latency" in alert_type.lower():
        recommended_actions.extend(
            [
                "Check service health dashboards (latency, error rate) and recent deploys.",
                "Correlate the spike window with upstream dependencies and infrastructure events.",
            ]
        )

    recommended_actions.extend(
        [
            "Pull the correlated logs for the time window and validate the triggering pattern.",
            "If confirmed, open or update an incident and document findings.",
        ]
    )

    severity_rank = {"low": 0, "medium": 1, "high": 2, "critical": 3}

    base_risk = severity if severity in severity_rank else "low"
    intel_risk = str(intel.risk_level) if intel is not None else None
    if intel_risk not in severity_rank:
        intel_risk = None

    anomaly_score = None
    if anomaly is not None and anomaly.score is not None:
        try:
            anomaly_score = float(anomaly.score)
        except Exception:
            anomaly_score = None

    derived_risk = base_risk
    if intel_risk is not None and severity_rank[intel_risk] > severity_rank[derived_risk]:
        derived_risk = intel_risk

    if anomaly_score is not None:
        if anomaly_score >= 0.9:
            derived_risk = "critical" if severity_rank[derived_risk] < 3 else derived_risk
        elif anomaly_score >= 0.75:
            derived_risk = "high" if severity_rank[derived_risk] < 2 else derived_risk

    # De-dupe while preserving order
    seen_actions = set()
    recommended_actions = [x for x in recommended_actions if not (x in seen_actions or seen_actions.add(x))]

    seen_evidence = set()
    evidence = [x for x in evidence if not (x in seen_evidence or seen_evidence.add(x))]

    return AnalyzeAlertResponse(
        analysis="\n".join(analysis_lines).strip(),
        risk_level=derived_risk,  # type: ignore[arg-type]
        evidence=evidence[:20],
        recommended_actions=recommended_actions[:20],
        threat_intel=intel_payload,
    )
