"""
SentinelAI API - Route Definitions
==================================

This module defines the API endpoints (routes) for accessing
AI-generated insights. Routes are thin controllers that delegate
to repository functions and return Pydantic schemas.

ROUTE DESIGN PRINCIPLES:
------------------------
1. No business logic in routes - delegate to repository
2. Use Pydantic schemas for request/response validation
3. Return consistent response formats
4. Handle errors gracefully with proper HTTP codes
5. Add OpenAPI documentation via decorators

AVAILABLE ENDPOINTS:
- GET /api/v1/anomalies - List recent anomalies
- GET /api/v1/root-causes - List recent root causes
- GET /api/v1/stats - Get summary statistics
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException

from src.api.schemas import (
    AnomalyListResponse,
    AnomalyResponse,
    RootCauseListResponse,
    RootCauseResponse,
    ExplanationsResponse,
    RemediationResponse,
    ErrorResponse
)
from src.api.repository import (
    get_recent_anomalies,
    get_latest_root_causes,
    get_anomaly_stats,
    get_root_cause_stats
)


# Create router with prefix and tags for OpenAPI grouping
router = APIRouter(prefix="/api/v1", tags=["AI Insights"])


@router.get(
    "/anomalies",
    response_model=AnomalyListResponse,
    summary="Get Recent Anomalies",
    description="Retrieve recent anomaly detection results from the AI engine. "
                "Returns anomalies sorted by detection time (most recent first).",
    responses={
        200: {"description": "List of anomalies"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def list_anomalies(
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of anomalies to return"
    ),
    service: Optional[str] = Query(
        default=None,
        description="Filter by service name"
    ),
    min_score: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=1.0,
        description="Minimum anomaly score (0-1)"
    ),
    hours: Optional[int] = Query(
        default=None,
        ge=1,
        le=168,
        description="Only return anomalies from the last N hours"
    )
):
    """
    List recent anomaly detection results.
    
    This endpoint returns anomalies that were flagged by the AI engine's
    autoencoder-based detection system. Results are sorted by detection
    time with most recent first.
    
    Query Parameters:
    - limit: Max results (1-100, default 20)
    - service: Filter by service name
    - min_score: Minimum anomaly score (0-1)
    - hours: Only anomalies from last N hours
    
    Returns:
        AnomalyListResponse with count and list of anomalies
    """
    try:
        # Fetch from repository
        anomalies = await get_recent_anomalies(
            limit=limit,
            service=service,
            min_score=min_score,
            hours=hours
        )
        
        # Convert to response schema
        anomaly_responses = []
        for a in anomalies:
            anomaly_responses.append(AnomalyResponse(
                timestamp=a.get("timestamp"),
                service=a.get("service", "unknown"),
                message=a.get("message", ""),
                level=a.get("level", "unknown"),
                anomaly_score=a.get("anomaly_score", 0.0),
                is_anomaly=a.get("is_anomaly", True),
                detected_at=a.get("detected_at")
            ))
        
        return AnomalyListResponse(
            count=len(anomaly_responses),
            anomalies=anomaly_responses
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching anomalies: {str(e)}"
        )


@router.get(
    "/root-causes",
    response_model=RootCauseListResponse,
    summary="Get Recent Root Causes",
    description="Retrieve recent root cause analysis results from the AI engine. "
                "Returns root causes sorted by detection time and confidence.",
    responses={
        200: {"description": "List of root causes"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def list_root_causes(
    limit: int = Query(
        default=5,
        ge=1,
        le=50,
        description="Maximum number of root causes to return"
    ),
    min_confidence: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=1.0,
        description="Minimum confidence score (0-1)"
    ),
    service: Optional[str] = Query(
        default=None,
        description="Filter by root cause service"
    )
):
    """
    List recent root cause analysis results.
    
    This endpoint returns correlated root cause insights that identify
    the likely underlying causes of groups of related anomalies.
    Results are sorted by detection time and confidence score.
    
    Query Parameters:
    - limit: Max results (1-50, default 5)
    - min_confidence: Minimum confidence score (0-1)
    - service: Filter by root cause service
    
    Returns:
        RootCauseListResponse with count and list of root causes
    """
    try:
        # Fetch from repository
        root_causes = await get_latest_root_causes(
            limit=limit,
            min_confidence=min_confidence,
            service=service
        )
        
        # Convert to response schema
        rc_responses = []
        for rc in root_causes:
            # Parse explanations if present
            explanations_data = rc.get("explanations", {})
            explanations = ExplanationsResponse(
                root_cause=explanations_data.get("root_cause"),
                timeline=explanations_data.get("timeline"),
                impact=explanations_data.get("impact"),
                recommendations=explanations_data.get("recommendations")
            ) if explanations_data else None
            
            # Parse remediation if present (enriched by repository)
            remediation_data = rc.get("remediation")
            remediation = RemediationResponse(
                issue_category=remediation_data.get("issue_category", "unknown"),
                description=remediation_data.get("description", ""),
                fix_steps=remediation_data.get("fix_steps", []),
                priority=remediation_data.get("priority", "MEDIUM"),
                estimated_resolution_time=remediation_data.get("estimated_resolution_time", "Unknown"),
                confidence_score=remediation_data.get("confidence_score", 0.0)
            ) if remediation_data else None
            
            rc_responses.append(RootCauseResponse(
                root_cause_message=rc.get("root_cause_message", ""),
                root_cause_service=rc.get("root_cause_service", "unknown"),
                affected_services=rc.get("affected_services", []),
                anomaly_count=rc.get("anomaly_count", 0),
                confidence_score=rc.get("confidence_score", 0.0),
                confidence_level=rc.get("confidence_level", "MEDIUM"),
                timeline_summary=rc.get("timeline_summary"),
                explanations=explanations,
                detected_at=rc.get("detected_at"),
                remediation=remediation
            ))
        
        return RootCauseListResponse(
            count=len(rc_responses),
            root_causes=rc_responses
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching root causes: {str(e)}"
        )


@router.get(
    "/stats",
    summary="Get AI Insights Statistics",
    description="Get summary statistics about anomalies and root causes.",
    responses={
        200: {"description": "Statistics summary"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def get_stats():
    """
    Get summary statistics about AI-generated insights.
    
    Returns counts, averages, and breakdowns for both anomalies
    and root causes stored in MongoDB.
    
    Returns:
        Dict with anomaly_stats and root_cause_stats
    """
    try:
        anomaly_stats = await get_anomaly_stats()
        root_cause_stats = await get_root_cause_stats()
        
        return {
            "anomalies": anomaly_stats,
            "root_causes": root_cause_stats
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching statistics: {str(e)}"
        )
