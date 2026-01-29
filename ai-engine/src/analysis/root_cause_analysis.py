"""
SentinelAI AI Engine - Root Cause Analysis Module
==================================================

This module implements root cause correlation and analysis for detected
anomalies. Instead of just flagging anomalies, it identifies the most
likely underlying cause(s) and their propagation path.

=== ROOT CAUSE DETECTION STRATEGY ===

1. GROUP ANOMALIES:
   - By service
   - By message similarity (same error type)
   - By time proximity (within ±2 minute window)

2. IDENTIFY ROOT CAUSES:
   - Earliest anomaly in each group = likely root cause
   - Later anomalies = likely symptoms/cascading failures

3. RANK ROOT CAUSES BY:
   - Anomaly score (reconstruction error)
   - Frequency (more errors = higher impact)
   - Temporal precedence (earliest first)

4. CALCULATE CONFIDENCE:
   - Heuristic-based (no ML retraining)
   - Based on: error score, group size, time clustering
   - Higher confidence = clearer causality

This is deterministic and explainable - no black boxes.
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional
from datetime import timedelta
from difflib import SequenceMatcher

from src.analysis.explanation_utils import (
    create_explanation_object,
    format_explanation_report
)


class RootCauseAnalyzer:
    """
    Analyzes detected anomalies to identify root causes and their propagation.
    """
    
    def __init__(
        self,
        time_window_minutes: int = 2,
        message_similarity_threshold: float = 0.6
    ):
        """
        Initialize the root cause analyzer.
        
        Args:
            time_window_minutes: Time window for grouping anomalies (default: 2 minutes)
            message_similarity_threshold: Threshold for message similarity (0-1)
        """
        self.time_window = timedelta(minutes=time_window_minutes)
        self.similarity_threshold = message_similarity_threshold
    
    def _calculate_message_similarity(self, msg1: str, msg2: str) -> float:
        """
        Calculate similarity between two log messages.
        
        Uses SequenceMatcher ratio as a simple similarity metric.
        
        Args:
            msg1: First message
            msg2: Second message
        
        Returns:
            Similarity score (0-1)
        """
        if not isinstance(msg1, str) or not isinstance(msg2, str):
            return 0.0
        
        # Normalize to lowercase for comparison
        msg1 = msg1.lower()
        msg2 = msg2.lower()
        
        return SequenceMatcher(None, msg1, msg2).ratio()
    
    def _group_anomalies_by_similarity(
        self,
        anomalies: pd.DataFrame
    ) -> List[List[int]]:
        """
        Group anomalies by message similarity.
        
        Args:
            anomalies: DataFrame of anomalous logs
        
        Returns:
            List of groups (each group is a list of indices)
        """
        if len(anomalies) == 0:
            return []
        
        groups = []
        used = set()
        
        for i, (idx1, log1) in enumerate(anomalies.iterrows()):
            if idx1 in used:
                continue
            
            group = [idx1]
            used.add(idx1)
            msg1 = log1.get('message', '')
            
            for idx2, log2 in anomalies.iterrows():
                if idx2 not in used:
                    msg2 = log2.get('message', '')
                    similarity = self._calculate_message_similarity(msg1, msg2)
                    
                    if similarity >= self.similarity_threshold:
                        group.append(idx2)
                        used.add(idx2)
            
            groups.append(group)
        
        return groups
    
    def _group_anomalies_by_service_and_time(
        self,
        anomalies: pd.DataFrame
    ) -> List[pd.DataFrame]:
        """
        Group anomalies by service and temporal proximity.
        
        Args:
            anomalies: DataFrame of anomalous logs
        
        Returns:
            List of grouped DataFrames
        """
        if len(anomalies) == 0:
            return []
        
        # Sort by service and timestamp
        anomalies = anomalies.sort_values(['service', 'timestamp']).copy()
        groups = []
        current_group = None
        last_timestamp = None
        last_service = None
        
        for idx, log in anomalies.iterrows():
            service = log.get('service')
            timestamp = pd.to_datetime(log.get('timestamp'))
            
            # Check if we should start a new group
            if (last_service is None or 
                service != last_service or 
                (last_timestamp is not None and timestamp - last_timestamp > self.time_window)):
                
                # Save current group if exists
                if current_group is not None and len(current_group) > 0:
                    groups.append(pd.DataFrame(current_group))
                
                # Start new group
                current_group = [log.to_dict()]
                last_service = service
                last_timestamp = timestamp
            else:
                # Add to current group
                current_group.append(log.to_dict())
                last_timestamp = timestamp
        
        # Don't forget the last group
        if current_group is not None and len(current_group) > 0:
            groups.append(pd.DataFrame(current_group))
        
        return groups
    
    def _calculate_confidence_score(
        self,
        root_cause_log: pd.Series,
        group: pd.DataFrame
    ) -> float:
        """
        Calculate confidence score for root cause hypothesis.
        
        Heuristic-based (no ML):
        - High anomaly score for root cause = higher confidence
        - Large group size = higher confidence (more evidence)
        - Tight time clustering = higher confidence
        
        Args:
            root_cause_log: The suspected root cause log
            group: All logs in the anomaly group
        
        Returns:
            Confidence score (0-1)
        """
        confidence = 0.0
        
        # Factor 1: Root cause anomaly score (0.4 weight)
        root_score = root_cause_log.get('anomaly_score', 0.5)
        confidence += min(root_score, 1.0) * 0.4
        
        # Factor 2: Group size (0.3 weight)
        # More anomalies = stronger evidence of cascading failure
        group_size = len(group)
        size_score = min(group_size / 10.0, 1.0)  # Normalize to 10 anomalies
        confidence += size_score * 0.3
        
        # Factor 3: Time clustering (0.3 weight)
        # Tightly clustered anomalies = higher confidence
        timestamps = pd.to_datetime(group['timestamp'])
        time_range = (timestamps.max() - timestamps.min()).total_seconds()
        time_window_seconds = self.time_window.total_seconds()
        
        if time_range == 0:
            time_score = 1.0
        else:
            # Score higher if anomalies are tightly clustered
            time_score = 1.0 - min(time_range / (time_window_seconds * 5), 1.0)
        
        confidence += time_score * 0.3
        
        return min(confidence, 1.0)
    
    def analyze(self, df: pd.DataFrame) -> List[Dict]:
        """
        Analyze anomalies to identify root causes.
        
        Args:
            df: DataFrame containing logs with anomaly flags and scores.
               Expected columns: timestamp, level, message, service, 
                               is_anomaly, anomaly_score, metadata
        
        Returns:
            List of root cause explanations (sorted by confidence)
        """
        # Filter anomalous logs only
        anomalies = df[df.get('is_anomaly', False)].copy()
        
        if len(anomalies) == 0:
            print("[INFO] No anomalies to analyze")
            return []
        
        print(f"[INFO] Analyzing {len(anomalies)} anomalies for root causes...")
        
        # Group anomalies by service and temporal proximity
        groups = self._group_anomalies_by_service_and_time(anomalies)
        
        print(f"[INFO] Grouped anomalies into {len(groups)} temporal clusters")
        
        root_causes = []
        
        for group_idx, group in enumerate(groups):
            if len(group) == 0:
                continue
            
            # Sort by timestamp to find root cause (earliest)
            group = group.sort_values('timestamp').reset_index(drop=True)
            root_cause_log = group.iloc[0]
            
            # Get affected services in this group
            affected_services = sorted(group['service'].unique().tolist())
            
            # Calculate confidence
            confidence = self._calculate_confidence_score(root_cause_log, group)
            
            # Create explanation
            explanation = create_explanation_object(
                root_cause_log=root_cause_log,
                affected_services=affected_services,
                anomaly_group=group,
                confidence_score=confidence,
                anomaly_count=len(group)
            )
            
            root_causes.append(explanation)
        
        # Sort by confidence (descending)
        root_causes.sort(key=lambda x: x['confidence_score'], reverse=True)
        
        print(f"[INFO] Identified {len(root_causes)} root cause(s)")
        
        return root_causes


def analyze_root_causes(
    df: pd.DataFrame,
    time_window_minutes: int = 2
) -> Tuple[List[Dict], pd.DataFrame]:
    """
    Convenience function to analyze root causes in a DataFrame.
    
    Args:
        df: DataFrame with anomaly data
        time_window_minutes: Time window for grouping anomalies
    
    Returns:
        Tuple of (root_causes, DataFrame with analysis added)
    """
    analyzer = RootCauseAnalyzer(time_window_minutes=time_window_minutes)
    root_causes = analyzer.analyze(df)
    
    return root_causes, df
