from __future__ import annotations

from fastapi import FastAPI

from .schemas import AnalyzeRequest, AnalyzeResponse
from .threat_intel import classify_source_ip
from .threats import assess_threat

app = FastAPI(title="SentinelAI AI Engine", version="0.1.0")

MODEL_VERSION = "heuristic-v1"


@app.get("/health")
def health():
    return {"ok": True, "model_version": MODEL_VERSION}


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
