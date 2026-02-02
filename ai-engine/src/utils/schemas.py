"""
SentinelAI AI Engine - MongoDB Schema Definitions
==================================================

This module defines the document structures (schemas) for persisting
AI-generated insights to MongoDB. These are dict-based templates
that describe what fields each document should contain.

WHY PERSIST AI INSIGHTS?
------------------------
1. Enable historical analysis and trend tracking
2. Allow other systems (APIs, dashboards) to query results
3. Support alerting and notification systems
4. Provide audit trail for detected anomalies
5. Enable machine learning on past predictions

COLLECTIONS:
- anomalies: Individual log entries flagged as anomalous
- root_causes: Correlated root cause analysis results

SCHEMA PHILOSOPHY:
- Flexible (no rigid validation) - allows evolution
- Self-documenting field names
- Timestamps for time-based queries
- Scores for filtering/ranking
"""

from datetime import datetime
from typing import Dict, List, Any, Optional


def create_anomaly_document(
    timestamp: datetime,
    service: str,
    message: str,
    level: str,
    anomaly_score: float,
    reconstruction_error: float,
    is_anomaly: bool,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create a document for the 'anomalies' collection.
    
    This represents a single log entry that was flagged as anomalous
    by the autoencoder-based detection system.
    
    Args:
        timestamp: When the original log was generated
        service: Which service generated the log
        message: The log message content
        level: Log level (ERROR, WARN, INFO, etc.)
        anomaly_score: Normalized anomaly score (0-1)
        reconstruction_error: Raw reconstruction error from autoencoder
        is_anomaly: Whether this log was flagged as anomalous
        metadata: Additional context from the original log
    
    Returns:
        Dict representing the anomaly document
    
    Schema:
    {
        "timestamp": datetime,           # Original log timestamp
        "service": str,                  # Service name
        "message": str,                  # Log message
        "level": str,                    # Log level
        "anomaly_score": float,          # 0-1 normalized score
        "reconstruction_error": float,   # Raw MSE value
        "is_anomaly": bool,              # True if flagged
        "metadata": dict,                # Additional context
        "detected_at": datetime,         # When analysis ran
        "pipeline_version": str          # For tracking changes
    }
    """
    return {
        # Original log data
        "timestamp": timestamp,
        "service": service,
        "message": message,
        "level": level,
        
        # Anomaly detection results
        "anomaly_score": anomaly_score,
        "reconstruction_error": reconstruction_error,
        "is_anomaly": is_anomaly,
        
        # Context
        "metadata": metadata or {},
        
        # Tracking
        "detected_at": datetime.utcnow(),
        "pipeline_version": "1.0.0"
    }


def create_root_cause_document(
    root_cause_message: str,
    root_cause_service: str,
    root_cause_timestamp: datetime,
    affected_services: List[str],
    anomaly_count: int,
    confidence_score: float,
    explanations: Dict[str, str],
    level_distribution: Dict[str, int],
    timeline_summary: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a document for the 'root_causes' collection.
    
    This represents a correlated root cause analysis result,
    identifying the likely underlying cause of a group of anomalies.
    
    Args:
        root_cause_message: Human-readable explanation
        root_cause_service: Service where root cause originated
        root_cause_timestamp: When the root cause occurred
        affected_services: List of services affected by this root cause
        anomaly_count: Number of correlated anomalies
        confidence_score: Confidence in this root cause (0-1)
        explanations: Detailed explanations (root_cause, timeline, impact)
        level_distribution: Count of ERROR/WARN/INFO in this group
        timeline_summary: Optional timeline description
    
    Returns:
        Dict representing the root cause document
    
    Schema:
    {
        "root_cause_message": str,       # Main explanation
        "root_cause_service": str,       # Origin service
        "root_cause_timestamp": datetime,# When it started
        "affected_services": [str],      # Impacted services
        "anomaly_count": int,            # Total anomalies
        "confidence_score": float,       # 0-1 confidence
        "confidence_level": str,         # HIGH/MEDIUM/LOW
        "explanations": {                # Detailed breakdown
            "root_cause": str,
            "timeline": str,
            "impact": str,
            "recommendations": str
        },
        "level_distribution": {          # Log level counts
            "ERROR": int,
            "WARN": int,
            "INFO": int
        },
        "timeline_summary": str,         # Timeline description
        "detected_at": datetime,         # When analysis ran
        "pipeline_version": str          # For tracking
    }
    """
    # Determine confidence level from score
    if confidence_score >= 0.75:
        confidence_level = "HIGH"
    elif confidence_score >= 0.50:
        confidence_level = "MEDIUM"
    else:
        confidence_level = "LOW"
    
    return {
        # Root cause identification
        "root_cause_message": root_cause_message,
        "root_cause_service": root_cause_service,
        "root_cause_timestamp": root_cause_timestamp,
        
        # Impact scope
        "affected_services": affected_services,
        "anomaly_count": anomaly_count,
        
        # Confidence
        "confidence_score": confidence_score,
        "confidence_level": confidence_level,
        
        # Detailed explanations
        "explanations": explanations,
        
        # Distribution
        "level_distribution": level_distribution,
        "timeline_summary": timeline_summary,
        
        # Tracking
        "detected_at": datetime.utcnow(),
        "pipeline_version": "1.0.0"
    }


# Collection names as constants
ANOMALIES_COLLECTION = "anomalies"
ROOT_CAUSES_COLLECTION = "root_causes"

# Index definitions for efficient querying
ANOMALY_INDEXES = [
    ("timestamp", -1),           # Sort by time descending
    ("service", 1),              # Filter by service
    ("is_anomaly", 1),           # Filter anomalies only
    ("anomaly_score", -1),       # Sort by severity
    ("detected_at", -1),         # Sort by detection time
]

ROOT_CAUSE_INDEXES = [
    ("detected_at", -1),         # Sort by detection time
    ("confidence_score", -1),    # Sort by confidence
    ("root_cause_service", 1),   # Filter by service
    ("affected_services", 1),    # Query affected services
]
