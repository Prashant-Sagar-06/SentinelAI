/**
 * SentinelAI Dashboard - Score Badge Component
 * =============================================
 * 
 * A color-coded badge for displaying scores/confidence levels.
 */

import React from 'react';
import './ScoreBadge.css';

/**
 * Get severity level based on score.
 * 
 * @param {number} score - Score between 0 and 1
 * @returns {string} Severity class name
 */
const getSeverity = (score) => {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
};

/**
 * Score badge component for anomaly scores and confidence levels.
 * 
 * @param {Object} props
 * @param {number} props.score - Score value (0-1)
 * @param {string} props.label - Optional label prefix
 */
export const ScoreBadge = ({ score, label }) => {
  const severity = getSeverity(score);
  const percentage = (score * 100).toFixed(0);
  
  return (
    <span className={`score-badge severity-${severity}`}>
      {label && <span className="score-label">{label}: </span>}
      {percentage}%
    </span>
  );
};

export default ScoreBadge;
