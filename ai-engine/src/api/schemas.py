"""
SentinelAI API - Pydantic Response Schemas
==========================================

This module defines the response schemas for the API endpoints.
Using Pydantic ensures type safety and automatic validation.

WHY PYDANTIC SCHEMAS?
---------------------
1. Type safety - Validates data before sending to clients
2. Documentation - Auto-generates OpenAPI/Swagger docs
3. Serialization - Handles datetime, ObjectId conversion
4. Consistency - Ensures uniform response format

DESIGN PRINCIPLES:
- Minimal responses (only necessary fields)
- No internal IDs exposed (security)
- Clean field names (snake_case)
- Optional fields have defaults
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str = Field(..., description="Service health status")
    service: str = Field(..., description="Service name")
    version: str = Field(..., description="API version")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Response timestamp")


class AnomalyResponse(BaseModel):
    """
    Response schema for a single anomaly detection result.
    
    This represents a log entry that was flagged as anomalous
    by the AI engine's autoencoder-based detection system.
    """
    timestamp: datetime = Field(..., description="When the original log was generated")
    service: str = Field(..., description="Service that generated the log")
    message: str = Field(..., description="Log message content")
    level: str = Field(default="unknown", description="Log level (ERROR, WARN, INFO)")
    anomaly_score: float = Field(..., description="Normalized anomaly score (0-1)")
    is_anomaly: bool = Field(default=True, description="Whether flagged as anomaly")
    detected_at: Optional[datetime] = Field(None, description="When anomaly was detected")
    
    class Config:
        json_schema_extra = {
            "example": {
                "timestamp": "2026-01-29T14:32:15Z",
                "service": "api-gateway",
                "message": "Connection timeout after 30000ms",
                "level": "ERROR",
                "anomaly_score": 0.87,
                "is_anomaly": True,
                "detected_at": "2026-01-29T14:35:00Z"
            }
        }


class AnomalyListResponse(BaseModel):
    """Response schema for list of anomalies."""
    count: int = Field(..., description="Number of anomalies returned")
    anomalies: List[AnomalyResponse] = Field(..., description="List of anomaly results")
    
    class Config:
        json_schema_extra = {
            "example": {
                "count": 2,
                "anomalies": [
                    {
                        "timestamp": "2026-01-29T14:32:15Z",
                        "service": "api-gateway",
                        "message": "Connection timeout",
                        "level": "ERROR",
                        "anomaly_score": 0.87,
                        "is_anomaly": True
                    }
                ]
            }
        }


class ExplanationsResponse(BaseModel):
    """Nested schema for root cause explanations."""
    root_cause: Optional[str] = Field(None, description="Root cause explanation")
    timeline: Optional[str] = Field(None, description="Timeline progression")
    impact: Optional[str] = Field(None, description="Impact assessment")
    recommendations: Optional[str] = Field(None, description="Recommended actions")


class RootCauseResponse(BaseModel):
    """
    Response schema for a root cause analysis result.
    
    This represents a correlated root cause insight that identifies
    the likely underlying cause of a group of related anomalies.
    """
    root_cause_message: str = Field(..., description="Human-readable root cause explanation")
    root_cause_service: str = Field(..., description="Service where root cause originated")
    affected_services: List[str] = Field(..., description="List of affected services")
    anomaly_count: int = Field(..., description="Number of correlated anomalies")
    confidence_score: float = Field(..., description="Confidence in this root cause (0-1)")
    confidence_level: str = Field(default="MEDIUM", description="HIGH/MEDIUM/LOW")
    timeline_summary: Optional[str] = Field(None, description="Timeline description")
    explanations: Optional[ExplanationsResponse] = Field(None, description="Detailed explanations")
    detected_at: Optional[datetime] = Field(None, description="When analysis was performed")
    
    class Config:
        json_schema_extra = {
            "example": {
                "root_cause_message": "Detected database error in database service at 14:32:15",
                "root_cause_service": "database",
                "affected_services": ["database", "api-gateway", "user-service"],
                "anomaly_count": 5,
                "confidence_score": 0.87,
                "confidence_level": "HIGH",
                "timeline_summary": "5 anomalies over 3m 45s across 3 services",
                "detected_at": "2026-01-29T14:35:00Z"
            }
        }


class RootCauseListResponse(BaseModel):
    """Response schema for list of root causes."""
    count: int = Field(..., description="Number of root causes returned")
    root_causes: List[RootCauseResponse] = Field(..., description="List of root cause results")
    
    class Config:
        json_schema_extra = {
            "example": {
                "count": 1,
                "root_causes": [
                    {
                        "root_cause_message": "Database connection pool exhausted",
                        "root_cause_service": "database",
                        "affected_services": ["database", "api-gateway"],
                        "anomaly_count": 3,
                        "confidence_score": 0.92,
                        "confidence_level": "HIGH"
                    }
                ]
            }
        }


class ErrorResponse(BaseModel):
    """Standard error response schema."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Additional details")
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": "NotFound",
                "message": "No anomalies found",
                "detail": "The anomalies collection is empty"
            }
        }
