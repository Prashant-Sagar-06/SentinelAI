"""
SentinelAI API - Data Access Repository
=======================================

This module provides read-only access to AI-generated insights
stored in MongoDB. It acts as a data access layer (DAL) between
the API routes and the database.

WHY A REPOSITORY LAYER?
-----------------------
1. Separation of concerns - Routes don't know about MongoDB
2. Testability - Easy to mock for unit tests
3. Reusability - Same functions can be used elsewhere
4. Query encapsulation - Complex queries in one place

DESIGN PRINCIPLES:
- READ-ONLY: No writes to database
- DEFENSIVE: Handle empty collections gracefully
- EFFICIENT: Use indexes, limit results
- CLEAN: Return dicts, not raw MongoDB documents
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pymongo import DESCENDING
from pymongo.errors import PyMongoError

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.utils.db import get_database
from src.analysis.remediation_engine import RemediationEngine


# Collection names (matching persist.py)
ANOMALIES_COLLECTION = "anomalies"
ROOT_CAUSES_COLLECTION = "root_causes"


def _clean_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Clean a MongoDB document for API response.
    
    Removes internal MongoDB fields and converts ObjectId to string.
    
    Args:
        doc: Raw MongoDB document
    
    Returns:
        Cleaned document suitable for API response
    """
    if doc is None:
        return {}
    
    # Remove MongoDB internal _id field
    cleaned = {k: v for k, v in doc.items() if k != '_id'}
    
    return cleaned


def _enrich_root_cause_with_remediation(
    root_cause: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Enrich a root cause document with remediation guidance.
    
    Uses the RemediationEngine to generate structured fix steps
    based on the root cause details.
    
    Args:
        root_cause: Root cause document from MongoDB
    
    Returns:
        Root cause document with remediation field added
    """
    try:
        engine = RemediationEngine()
        
        # Extract root cause details
        service = root_cause.get("root_cause_service", "unknown")
        message = root_cause.get("root_cause_message", "")
        confidence = root_cause.get("confidence_score")
        
        # Generate remediation
        remediation_result = engine.generate_remediation(
            root_cause_service=service,
            root_cause_message=message,
            root_cause_confidence=confidence
        )
        
        # Convert remediation to dict and add to root cause
        root_cause["remediation"] = remediation_result.to_dict()
        
    except Exception as e:
        # If remediation generation fails, continue without it
        # This ensures partial failures don't break the entire response
        print(f"[REPOSITORY] Warning: Failed to generate remediation: {e}")
        root_cause["remediation"] = None
    
    return root_cause


async def get_recent_anomalies(
    limit: int = 20,
    service: Optional[str] = None,
    min_score: Optional[float] = None,
    hours: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Retrieve recent anomaly detection results from MongoDB.
    
    Returns anomalies sorted by timestamp descending (most recent first).
    Only returns documents where is_anomaly=True.
    
    Args:
        limit: Maximum number of results to return (default: 20)
        service: Optional filter by service name
        min_score: Optional minimum anomaly score filter
        hours: Optional filter for anomalies within last N hours
    
    Returns:
        List of anomaly documents (cleaned for API response)
    
    Handles:
        - Empty collection (returns [])
        - Connection errors (returns [])
        - Missing fields (provides defaults)
    """
    try:
        db = get_database()
        collection = db[ANOMALIES_COLLECTION]
        
        # Build query filter
        query: Dict[str, Any] = {"is_anomaly": True}
        
        # Optional service filter
        if service:
            query["service"] = service
        
        # Optional minimum score filter
        if min_score is not None:
            query["anomaly_score"] = {"$gte": min_score}
        
        # Optional time filter
        if hours:
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            query["detected_at"] = {"$gte": cutoff}
        
        # Execute query with sorting and limit
        cursor = collection.find(query).sort("detected_at", DESCENDING).limit(limit)
        
        # Convert cursor to list and clean documents
        anomalies = []
        for doc in cursor:
            cleaned = _clean_document(doc)
            # Ensure required fields have defaults
            cleaned.setdefault("level", "unknown")
            cleaned.setdefault("is_anomaly", True)
            anomalies.append(cleaned)
        
        return anomalies
    
    except PyMongoError as e:
        print(f"[REPOSITORY] Error fetching anomalies: {e}")
        return []


async def get_latest_root_causes(
    limit: int = 5,
    min_confidence: Optional[float] = None,
    service: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieve latest root cause analysis results from MongoDB.
    
    Returns root causes sorted by detected_at descending (most recent first),
    then by confidence_score descending (highest confidence first).
    
    Automatically enriches each root cause with remediation guidance.
    
    Args:
        limit: Maximum number of results to return (default: 5)
        min_confidence: Optional minimum confidence score filter
        service: Optional filter by root cause service
    
    Returns:
        List of root cause documents (cleaned for API response) with remediation
    
    Handles:
        - Empty collection (returns [])
        - Connection errors (returns [])
        - Missing fields (provides defaults)
    """
    try:
        db = get_database()
        collection = db[ROOT_CAUSES_COLLECTION]
        
        # Build query filter
        query: Dict[str, Any] = {}
        
        # Optional confidence filter
        if min_confidence is not None:
            query["confidence_score"] = {"$gte": min_confidence}
        
        # Optional service filter
        if service:
            query["root_cause_service"] = service
        
        # Execute query with sorting and limit
        # Sort by detected_at first, then by confidence
        cursor = collection.find(query).sort([
            ("detected_at", DESCENDING),
            ("confidence_score", DESCENDING)
        ]).limit(limit)
        
        # Convert cursor to list and clean documents
        root_causes = []
        for doc in cursor:
            cleaned = _clean_document(doc)
            # Ensure required fields have defaults
            cleaned.setdefault("affected_services", [])
            cleaned.setdefault("anomaly_count", 0)
            cleaned.setdefault("confidence_level", "MEDIUM")
            cleaned.setdefault("explanations", {})
            
            # Enrich with remediation guidance
            cleaned = _enrich_root_cause_with_remediation(cleaned)
            
            root_causes.append(cleaned)
        
        return root_causes
    
    except PyMongoError as e:
        print(f"[REPOSITORY] Error fetching root causes: {e}")
        return []


async def get_anomaly_stats() -> Dict[str, Any]:
    """
    Get summary statistics about anomalies.
    
    Returns:
        Dict with total_count, by_service counts, avg_score
    """
    try:
        db = get_database()
        collection = db[ANOMALIES_COLLECTION]
        
        # Total count
        total = collection.count_documents({"is_anomaly": True})
        
        # Count by service using aggregation
        pipeline = [
            {"$match": {"is_anomaly": True}},
            {"$group": {"_id": "$service", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        by_service = list(collection.aggregate(pipeline))
        service_counts = {doc["_id"]: doc["count"] for doc in by_service if doc["_id"]}
        
        # Average score
        avg_pipeline = [
            {"$match": {"is_anomaly": True}},
            {"$group": {"_id": None, "avg_score": {"$avg": "$anomaly_score"}}}
        ]
        avg_result = list(collection.aggregate(avg_pipeline))
        avg_score = avg_result[0]["avg_score"] if avg_result else 0.0
        
        return {
            "total_anomalies": total,
            "by_service": service_counts,
            "average_score": round(avg_score, 3) if avg_score else 0.0
        }
    
    except PyMongoError as e:
        print(f"[REPOSITORY] Error fetching stats: {e}")
        return {"total_anomalies": 0, "by_service": {}, "average_score": 0.0}


async def get_root_cause_stats() -> Dict[str, Any]:
    """
    Get summary statistics about root causes.
    
    Returns:
        Dict with total_count, avg_confidence, by_confidence_level
    """
    try:
        db = get_database()
        collection = db[ROOT_CAUSES_COLLECTION]
        
        # Total count
        total = collection.count_documents({})
        
        # Count by confidence level
        pipeline = [
            {"$group": {"_id": "$confidence_level", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        by_level = list(collection.aggregate(pipeline))
        level_counts = {doc["_id"]: doc["count"] for doc in by_level if doc["_id"]}
        
        # Average confidence
        avg_pipeline = [
            {"$group": {"_id": None, "avg_confidence": {"$avg": "$confidence_score"}}}
        ]
        avg_result = list(collection.aggregate(avg_pipeline))
        avg_confidence = avg_result[0]["avg_confidence"] if avg_result else 0.0
        
        return {
            "total_root_causes": total,
            "by_confidence_level": level_counts,
            "average_confidence": round(avg_confidence, 3) if avg_confidence else 0.0
        }
    
    except PyMongoError as e:
        print(f"[REPOSITORY] Error fetching root cause stats: {e}")
        return {"total_root_causes": 0, "by_confidence_level": {}, "average_confidence": 0.0}
