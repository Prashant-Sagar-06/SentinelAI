# SentinelAI AI Engine - Analysis Package
"""
Analysis modules for SentinelAI AI Engine.

This package contains:
- anomaly_detection: Autoencoder-based anomaly detection
- root_cause_analysis: Root cause correlation and analysis
- explanation_utils: Human-readable explanation generation
- remediation_kb: Remediation knowledge base (patterns to fix steps)
- remediation_engine: Remediation recommendation engine
"""

from src.analysis.remediation_kb import (
    REMEDIATION_KB,
    RemediationMatcher,
    RemediationEntry,
    Priority
)
from src.analysis.remediation_engine import (
    RemediationEngine,
    RemediationResult
)

__all__ = [
    'REMEDIATION_KB',
    'RemediationMatcher',
    'RemediationEntry',
    'Priority',
    'RemediationEngine',
    'RemediationResult'
]