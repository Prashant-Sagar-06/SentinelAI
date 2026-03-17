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

    model_version: str
    anomaly_score: float = Field(ge=0.0, le=1.0)
    risk_score: float = Field(ge=0.0, le=1.0)
    risk_level: RiskLevel
    threat_type: str
    explanations: List[str]
    features: Optional[Dict[str, Any]] = None
