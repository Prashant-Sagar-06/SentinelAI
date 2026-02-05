"""
SentinelAI - Remediation Engine
================================

This module implements the remediation recommendation engine that suggests
how to fix identified root causes. It combines the knowledge base with
root cause analysis results to provide structured remediation guidance.

WHY A SEPARATE ENGINE?
----------------------
1. Decouples remediation logic from knowledge base
2. Handles transformation from root cause → remediation
3. Adds confidence scoring for remediation suggestions
4. Makes testing and evolution easier
5. Provides a clear API for integration points

FLOW:
  RootCause → RemediationEngine → RemediationResult
                     ↓
              Matched against KB keywords
                     ↓
              Returns structured fix steps
"""

from typing import Dict, Optional, List
from dataclasses import dataclass, asdict

from src.analysis.remediation_kb import RemediationMatcher, Priority


@dataclass
class RemediationResult:
    """
    Structured remediation guidance for a root cause.
    
    Attributes:
        issue_category: Category identifier for the issue
        description: Professional explanation of the issue
        fix_steps: List of actionable remediation steps
        priority: Remediation priority (affects urgency)
        estimated_resolution_time: Human-readable time estimate
        confidence_score: How confident we are in this match (0-1)
    """
    issue_category: str
    description: str
    fix_steps: List[str]
    priority: str
    estimated_resolution_time: str
    confidence_score: float
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return asdict(self)


class RemediationEngine:
    """
    Generates remediation guidance for root causes.
    
    This is a deterministic, rule-based engine that matches root causes
    to remediation entries and calculates confidence scores.
    """
    
    def __init__(self):
        """Initialize the remediation engine."""
        self.matcher = RemediationMatcher()
        # Confidence score multipliers for different match scenarios
        self.HIGH_CONFIDENCE_MULTIPLIER = 1.0     # Perfect match or very relevant
        self.MEDIUM_CONFIDENCE_MULTIPLIER = 0.75   # Partial match
        self.LOW_CONFIDENCE_MULTIPLIER = 0.5       # Weak match
    
    def generate_remediation(
        self,
        root_cause_service: str,
        root_cause_message: str,
        anomaly_patterns: Optional[List[str]] = None,
        root_cause_confidence: Optional[float] = None
    ) -> RemediationResult:
        """
        Generate remediation guidance for a detected root cause.
        
        This method matches the root cause to the knowledge base and
        calculates a confidence score for the remediation suggestion.
        
        Args:
            root_cause_service: Service where root cause originated
            root_cause_message: Root cause error message or description
            anomaly_patterns: Optional list of patterns detected in anomalies
            root_cause_confidence: Optional confidence of root cause (0-1)
        
        Returns:
            RemediationResult with fix steps and guidance
        
        Example:
            >>> engine = RemediationEngine()
            >>> result = engine.generate_remediation(
            ...     root_cause_service="mongodb",
            ...     root_cause_message="Connection timeout after 30s",
            ...     root_cause_confidence=0.87
            ... )
            >>> print(result.description)
            >>> for step in result.fix_steps:
            ...     print(f"  - {step}")
        """
        # Find matching remediation from knowledge base
        # This is deterministic based on keywords in service and message
        remediation_entry = self.matcher.find_matching_remediation(
            service=root_cause_service,
            message=root_cause_message
        )
        
        # Calculate confidence score for the remediation
        remediation_confidence = self._calculate_confidence(
            root_cause_service=root_cause_service,
            root_cause_message=root_cause_message,
            matched_category=remediation_entry.issue_category,
            root_cause_confidence=root_cause_confidence,
            anomaly_patterns=anomaly_patterns
        )
        
        # Build result object
        result = RemediationResult(
            issue_category=remediation_entry.issue_category,
            description=remediation_entry.description,
            fix_steps=remediation_entry.fix_steps,
            priority=remediation_entry.priority.value,  # Convert Enum to string
            estimated_resolution_time=remediation_entry.estimated_resolution_time,
            confidence_score=remediation_confidence
        )
        
        return result
    
    def _calculate_confidence(
        self,
        root_cause_service: str,
        root_cause_message: str,
        matched_category: str,
        root_cause_confidence: Optional[float] = None,
        anomaly_patterns: Optional[List[str]] = None
    ) -> float:
        """
        Calculate confidence score for the remediation match.
        
        Confidence depends on:
        1. How well the root cause message matches knowledge base keywords
        2. The confidence of the original root cause analysis
        3. Number of anomaly patterns that correlate with the match
        
        Args:
            root_cause_service: Service name
            root_cause_message: Error message
            matched_category: Matched remediation category
            root_cause_confidence: Original RCA confidence (optional)
            anomaly_patterns: Anomaly patterns detected (optional)
        
        Returns:
            Confidence score (0.0 - 1.0)
        """
        base_score = 0.5  # Start with baseline confidence
        
        # Boost if root cause already had high confidence
        if root_cause_confidence is not None:
            if root_cause_confidence >= 0.85:
                base_score = min(1.0, base_score + 0.35)
            elif root_cause_confidence >= 0.70:
                base_score = min(1.0, base_score + 0.20)
            elif root_cause_confidence >= 0.50:
                base_score = min(1.0, base_score + 0.10)
        
        # Boost if matched category is not the unknown fallback
        if matched_category != "unknown_error":
            base_score = min(1.0, base_score + 0.15)
        
        # Boost if service name has strong keyword match
        if self._has_strong_keyword_match(root_cause_service, matched_category):
            base_score = min(1.0, base_score + 0.10)
        
        # Boost based on anomaly pattern count (more patterns = higher match)
        if anomaly_patterns and isinstance(anomaly_patterns, list):
            # Each pattern increases confidence slightly
            pattern_boost = min(0.15, len(anomaly_patterns) * 0.03)
            base_score = min(1.0, base_score + pattern_boost)
        
        # Ensure score is in valid range
        return max(0.0, min(1.0, base_score))
    
    def _has_strong_keyword_match(
        self,
        service_name: str,
        category: str
    ) -> bool:
        """
        Check if service name has strong keyword match with category.
        
        Args:
            service_name: Service name to check
            category: Remediation category to check against
        
        Returns:
            True if there's a strong keyword match
        """
        # Get the knowledge base entry for this category
        remediation_entry = self.matcher.get_remediation_by_category(category)
        
        if not remediation_entry:
            return False
        
        # Check if any keywords appear in the service name
        service_lower = service_name.lower()
        matches = sum(
            1 for keyword in remediation_entry.keywords
            if keyword.lower() in service_lower
        )
        
        # Strong match = 2+ keywords or exact match with primary keyword
        return matches >= 2 or (
            remediation_entry.keywords and 
            remediation_entry.keywords[0].lower() in service_lower
        )
    
    def get_remediation_categories(self) -> List[str]:
        """
        Get list of all available remediation categories.
        
        Useful for dashboard dropdowns or categorization UI.
        
        Returns:
            List of category identifiers
        """
        return self.matcher.get_all_categories()
