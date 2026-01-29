"""
SentinelAI AI Engine - Explanation Utilities
==============================================

This module generates human-readable explanations for detected anomalies
and their root causes. Explanations are template-based and dynamically
populated with actual log data.

=== EXPLANATION STRATEGY ===

Instead of hard-coded messages, we use templates with dynamic values:
- Service names come from actual logs
- Error types are extracted from messages
- Timeline information is calculated from timestamps
- Confidence scores are heuristic-based

This ensures explanations are contextual and accurate.
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import pandas as pd


def format_timestamp(ts: datetime) -> str:
    """
    Format a timestamp for display.
    
    Args:
        ts: datetime object
    
    Returns:
        Formatted string (e.g., "14:35:22")
    """
    if isinstance(ts, str):
        try:
            ts = pd.to_datetime(ts)
        except:
            return str(ts)
    return ts.strftime("%H:%M:%S")


def format_duration(seconds: float) -> str:
    """
    Format a duration in seconds to human-readable form.
    
    Args:
        seconds: Duration in seconds
    
    Returns:
        Formatted string (e.g., "2m 15s", "45s")
    """
    if seconds < 60:
        return f"{int(seconds)}s"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        return f"{hours}h {minutes}m"


def extract_error_type(message: str) -> str:
    """
    Extract the error/warning type from a log message.
    
    Args:
        message: Log message string
    
    Returns:
        Extracted error type (e.g., "database timeout", "connection refused")
    """
    message_lower = message.lower()
    
    # Common error patterns
    error_patterns = {
        "timeout": "timeout",
        "connection refused": "connection refused",
        "memory": "memory issue",
        "database": "database error",
        "api": "api error",
        "failed": "failure",
        "error": "error",
        "exception": "exception",
        "crash": "crash",
        "warning": "warning"
    }
    
    for pattern, label in error_patterns.items():
        if pattern in message_lower:
            return label
    
    # If no pattern found, return first few words
    words = message.split()
    return " ".join(words[:3]) if words else "unknown error"


def generate_root_cause_explanation(
    root_cause_log: pd.Series,
    affected_services: List[str],
    anomaly_group: pd.DataFrame,
    confidence_score: float
) -> str:
    """
    Generate a human-readable explanation for a root cause.
    
    Args:
        root_cause_log: The log representing the root cause
        affected_services: List of services affected by this anomaly
        anomaly_group: All anomalies in this group (for context)
        confidence_score: Confidence score (0-1)
    
    Returns:
        Human-readable explanation string
    """
    root_service = root_cause_log.get('service', 'unknown-service')
    error_type = extract_error_type(root_cause_log.get('message', ''))
    
    # Time information
    root_time = pd.to_datetime(root_cause_log.get('timestamp'))
    
    # Count anomalies after root cause
    downstream_count = len(anomaly_group) - 1
    
    if len(affected_services) == 1:
        # Single service affected
        explanation = (
            f"Detected {error_type} in {root_service} at {format_timestamp(root_time)}. "
            f"This is the earliest detected anomaly in the group."
        )
    else:
        # Multiple services affected
        services_str = ", ".join(affected_services[:-1]) + f" and {affected_services[-1]}"
        explanation = (
            f"Detected {error_type} in {root_service} at {format_timestamp(root_time)}, "
            f"which cascaded to {services_str} ({downstream_count} downstream anomalies)."
        )
    
    # Add confidence context
    if confidence_score >= 0.8:
        explanation += " [HIGH confidence]"
    elif confidence_score >= 0.6:
        explanation += " [MEDIUM confidence]"
    else:
        explanation += " [LOW confidence]"
    
    return explanation


def generate_timeline_explanation(
    anomaly_group: pd.DataFrame,
) -> str:
    """
    Generate a timeline explanation showing progression of anomalies.
    
    Args:
        anomaly_group: DataFrame of related anomalies
    
    Returns:
        Timeline explanation string
    """
    if len(anomaly_group) < 2:
        return "Single anomaly detected - no temporal pattern."
    
    # Sort by timestamp
    sorted_group = anomaly_group.sort_values('timestamp')
    
    first_time = pd.to_datetime(sorted_group.iloc[0]['timestamp'])
    last_time = pd.to_datetime(sorted_group.iloc[-1]['timestamp'])
    duration = (last_time - first_time).total_seconds()
    
    unique_services = sorted_group['service'].nunique()
    unique_levels = sorted_group['level'].unique()
    
    timeline = f"Timeline: {len(sorted_group)} anomalies detected over {format_duration(duration)} "
    timeline += f"across {unique_services} service(s). "
    timeline += f"Severity: {', '.join([l.upper() for l in unique_levels])}."
    
    return timeline


def generate_impact_explanation(
    anomaly_group: pd.DataFrame,
    confidence_score: float
) -> str:
    """
    Generate an explanation of the impact and severity.
    
    Args:
        anomaly_group: DataFrame of related anomalies
        confidence_score: Confidence score (0-1)
    
    Returns:
        Impact explanation string
    """
    error_count = len(anomaly_group[anomaly_group['level'] == 'error'])
    warn_count = len(anomaly_group[anomaly_group['level'] == 'warn'])
    
    impact = f"Impact: {error_count} ERROR(s), {warn_count} WARNING(s). "
    
    # Determine severity
    if error_count > 5:
        severity = "CRITICAL"
    elif error_count > 2 or warn_count > 5:
        severity = "HIGH"
    elif error_count > 0 or warn_count > 2:
        severity = "MEDIUM"
    else:
        severity = "LOW"
    
    impact += f"Severity: {severity}. "
    
    # Confidence-based recommendation
    if confidence_score >= 0.8:
        impact += "Recommendation: Investigate immediately."
    elif confidence_score >= 0.6:
        impact += "Recommendation: Monitor closely."
    else:
        impact += "Recommendation: Verify before escalating."
    
    return impact


def create_explanation_object(
    root_cause_log: pd.Series,
    affected_services: List[str],
    anomaly_group: pd.DataFrame,
    confidence_score: float,
    anomaly_count: int
) -> Dict:
    """
    Create a structured explanation object for root cause analysis.
    
    Args:
        root_cause_log: The log representing the root cause
        affected_services: List of affected services
        anomaly_group: All anomalies in this group
        confidence_score: Confidence score (0-1)
        anomaly_count: Total count of anomalies in group
    
    Returns:
        Dictionary with structured explanation
    """
    return {
        'root_cause_message': root_cause_log.get('message', 'Unknown'),
        'root_cause_service': root_cause_log.get('service', 'unknown'),
        'root_cause_timestamp': pd.to_datetime(root_cause_log.get('timestamp')),
        'affected_services': affected_services,
        'anomaly_count': anomaly_count,
        'confidence_score': round(confidence_score, 3),
        'root_cause_explanation': generate_root_cause_explanation(
            root_cause_log, affected_services, anomaly_group, confidence_score
        ),
        'timeline_explanation': generate_timeline_explanation(anomaly_group),
        'impact_explanation': generate_impact_explanation(anomaly_group, confidence_score),
        'anomaly_level_distribution': anomaly_group['level'].value_counts().to_dict()
    }


def format_explanation_report(explanation: Dict) -> str:
    """
    Format an explanation object into a readable report.
    
    Args:
        explanation: Explanation dictionary
    
    Returns:
        Formatted report string
    """
    report = "\n" + "─" * 60 + "\n"
    report += "ROOT CAUSE ANALYSIS\n"
    report += "─" * 60 + "\n\n"
    
    report += f"Service:              {explanation['root_cause_service'].upper()}\n"
    report += f"Confidence:           {explanation['confidence_score'] * 100:.1f}%\n"
    report += f"Affected Services:    {', '.join(explanation['affected_services'])}\n"
    report += f"Anomaly Count:        {explanation['anomaly_count']}\n"
    report += f"Root Cause:           {explanation['root_cause_timestamp'].strftime('%H:%M:%S')}\n"
    
    report += "\n" + "─" * 60 + "\n"
    report += "EXPLANATION\n"
    report += "─" * 60 + "\n"
    report += explanation['root_cause_explanation'] + "\n"
    
    report += "\n" + "─" * 60 + "\n"
    report += explanation['timeline_explanation'] + "\n"
    report += explanation['impact_explanation'] + "\n"
    
    return report
