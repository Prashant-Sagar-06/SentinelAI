"""
SentinelAI AI Engine - Persistence Utilities
=============================================

This module handles persisting AI-generated insights to MongoDB.
It provides isolated, reusable functions for saving anomaly detection
results and root cause analysis outputs.

WHY PERSISTENCE?
----------------
The CLI-based pipeline (python main.py) generates valuable insights
that would be lost after execution. By persisting to MongoDB:

1. QUERYABILITY: Other systems can query results via standard MongoDB APIs
2. VISUALIZATION: Dashboards can display historical trends
3. ALERTING: Alert systems can monitor for high-severity anomalies
4. AUDIT TRAIL: Track what was detected and when
5. ANALYTICS: Analyze patterns over time

DESIGN PRINCIPLES:
- Isolated: Persistence logic is separate from detection logic
- Reusable: Same functions can be called from APIs later
- Safe: Handles duplicates and errors gracefully
- Observable: Logs success/failure for debugging
"""

import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Tuple
from pymongo import MongoClient
from pymongo.errors import BulkWriteError, PyMongoError

from src.utils.db import get_database
from src.utils.schemas import (
    create_anomaly_document,
    create_root_cause_document,
    ANOMALIES_COLLECTION,
    ROOT_CAUSES_COLLECTION,
    ANOMALY_INDEXES,
    ROOT_CAUSE_INDEXES
)


def ensure_indexes(db) -> None:
    """
    Create indexes on collections for efficient querying.
    
    This is idempotent - calling multiple times is safe.
    Indexes are created in background to avoid blocking.
    """
    try:
        # Anomalies collection indexes
        anomalies = db[ANOMALIES_COLLECTION]
        for field, direction in ANOMALY_INDEXES:
            anomalies.create_index([(field, direction)], background=True)
        
        # Root causes collection indexes
        root_causes = db[ROOT_CAUSES_COLLECTION]
        for field, direction in ROOT_CAUSE_INDEXES:
            root_causes.create_index([(field, direction)], background=True)
        
        print("[PERSIST] Indexes ensured on collections")
    except PyMongoError as e:
        print(f"[PERSIST] Warning: Could not create indexes: {e}")


def save_anomalies(anomaly_df: pd.DataFrame) -> Tuple[int, int]:
    """
    Save anomaly detection results to MongoDB.
    
    Persists each row of the DataFrame as a document in the 'anomalies'
    collection. Only saves rows where is_anomaly=True to avoid storing
    normal logs (those are already in the 'logs' collection).
    
    Args:
        anomaly_df: DataFrame with columns:
            - timestamp
            - service
            - message
            - level
            - anomaly_score
            - reconstruction_error
            - is_anomaly
            - metadata (optional)
    
    Returns:
        Tuple of (inserted_count, skipped_count)
    
    Handles:
        - Empty DataFrames (returns 0, 0)
        - Duplicate inserts (skips gracefully)
        - Connection errors (logs and returns 0, 0)
    """
    if anomaly_df is None or len(anomaly_df) == 0:
        print("[PERSIST] No anomalies to save (empty DataFrame)")
        return 0, 0
    
    # Filter to only anomalous logs
    anomalies_only = anomaly_df[anomaly_df.get('is_anomaly', False) == True]
    
    if len(anomalies_only) == 0:
        print("[PERSIST] No anomalies to save (no is_anomaly=True rows)")
        return 0, 0
    
    try:
        db = get_database()
        collection = db[ANOMALIES_COLLECTION]
        
        # Ensure indexes exist
        ensure_indexes(db)
        
        # Convert DataFrame rows to documents
        documents = []
        for _, row in anomalies_only.iterrows():
            doc = create_anomaly_document(
                timestamp=pd.to_datetime(row.get('timestamp')),
                service=str(row.get('service', 'unknown')),
                message=str(row.get('message', '')),
                level=str(row.get('level', 'unknown')),
                anomaly_score=float(row.get('anomaly_score', 0.0)),
                reconstruction_error=float(row.get('reconstruction_error', 0.0)),
                is_anomaly=bool(row.get('is_anomaly', False)),
                metadata=row.get('metadata') if pd.notna(row.get('metadata')) else None
            )
            documents.append(doc)
        
        if len(documents) == 0:
            print("[PERSIST] No valid documents to insert")
            return 0, 0
        
        # Insert documents
        # Using insert_many with ordered=False to continue on duplicates
        result = collection.insert_many(documents, ordered=False)
        inserted = len(result.inserted_ids)
        skipped = len(documents) - inserted
        
        print(f"[PERSIST] Saved {inserted} anomalies to '{ANOMALIES_COLLECTION}' collection")
        if skipped > 0:
            print(f"[PERSIST] Skipped {skipped} duplicate entries")
        
        return inserted, skipped
    
    except BulkWriteError as e:
        # Some documents were inserted, some failed (likely duplicates)
        inserted = e.details.get('nInserted', 0)
        print(f"[PERSIST] Partial save: {inserted} anomalies saved, some duplicates skipped")
        return inserted, len(anomalies_only) - inserted
    
    except PyMongoError as e:
        print(f"[PERSIST] Error saving anomalies: {e}")
        return 0, 0


def save_root_causes(root_cause_objects: List[Dict[str, Any]]) -> Tuple[int, int]:
    """
    Save root cause analysis results to MongoDB.
    
    Persists each root cause explanation as a document in the 'root_causes'
    collection. These are the correlated insights from the RCA module.
    
    Args:
        root_cause_objects: List of root cause dictionaries with keys:
            - root_cause_message
            - root_cause_service
            - root_cause_timestamp
            - affected_services
            - anomaly_count
            - confidence_score
            - explanations
            - level_distribution
    
    Returns:
        Tuple of (inserted_count, skipped_count)
    
    Handles:
        - Empty lists (returns 0, 0)
        - Duplicate inserts (skips gracefully)
        - Connection errors (logs and returns 0, 0)
    """
    if root_cause_objects is None or len(root_cause_objects) == 0:
        print("[PERSIST] No root causes to save (empty list)")
        return 0, 0
    
    try:
        db = get_database()
        collection = db[ROOT_CAUSES_COLLECTION]
        
        # Ensure indexes exist
        ensure_indexes(db)
        
        # Convert root cause objects to documents
        documents = []
        for rc in root_cause_objects:
            # Parse timestamp - handle both string and datetime
            rc_timestamp = rc.get('root_cause_timestamp')
            if isinstance(rc_timestamp, str):
                try:
                    rc_timestamp = datetime.fromisoformat(rc_timestamp.replace('Z', '+00:00'))
                except:
                    rc_timestamp = datetime.utcnow()
            elif not isinstance(rc_timestamp, datetime):
                rc_timestamp = datetime.utcnow()
            
            doc = create_root_cause_document(
                root_cause_message=str(rc.get('root_cause_message', '')),
                root_cause_service=str(rc.get('root_cause_service', 'unknown')),
                root_cause_timestamp=rc_timestamp,
                affected_services=list(rc.get('affected_services', [])),
                anomaly_count=int(rc.get('anomaly_count', 0)),
                confidence_score=float(rc.get('confidence_score', 0.0)),
                explanations=dict(rc.get('explanations', {})),
                level_distribution=dict(rc.get('level_distribution', {})),
                timeline_summary=rc.get('explanations', {}).get('timeline', '')
            )
            documents.append(doc)
        
        if len(documents) == 0:
            print("[PERSIST] No valid root cause documents to insert")
            return 0, 0
        
        # Insert documents
        result = collection.insert_many(documents, ordered=False)
        inserted = len(result.inserted_ids)
        skipped = len(documents) - inserted
        
        print(f"[PERSIST] Saved {inserted} root causes to '{ROOT_CAUSES_COLLECTION}' collection")
        if skipped > 0:
            print(f"[PERSIST] Skipped {skipped} duplicate entries")
        
        return inserted, skipped
    
    except BulkWriteError as e:
        inserted = e.details.get('nInserted', 0)
        print(f"[PERSIST] Partial save: {inserted} root causes saved, some duplicates skipped")
        return inserted, len(root_cause_objects) - inserted
    
    except PyMongoError as e:
        print(f"[PERSIST] Error saving root causes: {e}")
        return 0, 0


def persist_analysis_results(
    anomaly_df: pd.DataFrame,
    root_causes: List[Dict[str, Any]]
) -> Dict[str, Tuple[int, int]]:
    """
    Persist all analysis results in a single call.
    
    This is the main entry point for persisting pipeline outputs.
    It saves both anomaly detection results and root cause insights.
    
    Args:
        anomaly_df: DataFrame with anomaly detection results
        root_causes: List of root cause analysis results
    
    Returns:
        Dict with 'anomalies' and 'root_causes' keys,
        each containing (inserted, skipped) tuple
    
    Example:
        results = persist_analysis_results(df, root_causes)
        print(f"Anomalies: {results['anomalies'][0]} saved")
        print(f"Root causes: {results['root_causes'][0]} saved")
    """
    print()
    print("=" * 70)
    print("[PERSIST] Saving analysis results to MongoDB")
    print("=" * 70)
    
    # Save anomalies
    anomaly_result = save_anomalies(anomaly_df)
    
    # Save root causes
    root_cause_result = save_root_causes(root_causes)
    
    print(f"\n[PERSIST] Summary:")
    print(f"         - Anomalies saved: {anomaly_result[0]}")
    print(f"         - Root causes saved: {root_cause_result[0]}")
    
    return {
        'anomalies': anomaly_result,
        'root_causes': root_cause_result
    }
