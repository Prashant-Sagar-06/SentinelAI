from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class Actor(BaseModel):
    user: Optional[str] = None
    service: Optional[str] = None
    role: Optional[str] = None


class Network(BaseModel):
    ip: Optional[str] = None
    user_agent: Optional[str] = None


class SecurityEvent(BaseModel):
    timestamp: datetime
    source: str
    event_type: str

    message: Optional[str] = None
    status: Optional[str] = None
    severity_hint: Optional[str] = None

    tenant_id: Optional[str] = None
    ingest_id: Optional[str] = None

    actor: Optional[Actor] = None
    network: Optional[Network] = None

    attributes: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)


RiskLevel = Literal["low", "medium", "high", "critical"]


class AnalyzeRequest(BaseModel):
    event: SecurityEvent


class AnalyzeResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    event_id: str
    model_version: str
    anomaly_score: float = Field(ge=0.0, le=1.0)
    risk_score: float = Field(ge=0.0, le=1.0)
    risk_level: RiskLevel
    threat_type: str
    explanations: List[str]
    features: Optional[Dict[str, Any]] = None


class DetectAnomalyRequest(BaseModel):
    requests_per_minute: float = Field(ge=0.0)
    avg_latency: float = Field(ge=0.0)
    error_rate: float = Field(ge=0.0, le=1.0)
    unique_ips: float = Field(ge=0.0)


class DetectAnomalyResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    anomaly: bool
    score: float = Field(ge=0.0, le=1.0)
    reason: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class CopilotAlert(BaseModel):
    alert_id: Optional[str] = None
    title: Optional[str] = None

    # SentinelAI alert fields (support both threat alerts and rule/anomaly alerts)
    type: Optional[str] = None
    threat_type: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None
    reason: Optional[str] = None

    source_ip: Optional[str] = None
    actor: Optional[str] = None
    event_count: Optional[int] = None

    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    explanations: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CopilotAnomaly(BaseModel):
    type: Optional[str] = None
    score: Optional[float] = None
    severity: Optional[str] = None
    message: Optional[str] = None
    reason: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    createdAt: Optional[datetime] = None


class AnalyzeAlertRequest(BaseModel):
    alert: CopilotAlert
    anomaly: Optional[CopilotAnomaly] = None


class AnalyzeAlertResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    analysis: str
    risk_level: Optional[RiskLevel] = None
    evidence: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    threat_intel: Optional[Dict[str, Any]] = None
