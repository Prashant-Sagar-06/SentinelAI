/**
 * SentinelAI Dashboard - Remediation Guidance Component
 * =====================================================
 * 
 * Displays structured remediation guidance for a root cause.
 * Shows fix steps, priority level, and estimated resolution time.
 */

import React from 'react';
import './RemediationGuidance.css';

/**
 * Priority badge component with color coding.
 */
const PriorityBadge = ({ priority }) => {
  const priorityClass = priority ? priority.toLowerCase() : 'medium';
  return (
    <span className={`priority-badge priority-${priorityClass}`}>
      {priority || 'UNKNOWN'}
    </span>
  );
};

/**
 * Remediation guidance component.
 * 
 * Props:
 *   remediation: Remediation object with issue_category, description, fix_steps, etc.
 */
export const RemediationGuidance = ({ remediation }) => {
  if (!remediation) {
    return (
      <div className="remediation-guidance empty">
        <p className="no-remediation">No remediation guidance available</p>
      </div>
    );
  }

  const {
    issue_category,
    description,
    fix_steps = [],
    priority = 'MEDIUM',
    estimated_resolution_time,
    confidence_score
  } = remediation;

  return (
    <div className="remediation-guidance">
      <div className="remediation-header">
        <div className="remediation-title">
          <h4>Recommended Fix</h4>
          <PriorityBadge priority={priority} />
        </div>
        {confidence_score !== undefined && (
          <div className="remediation-confidence">
            <span className="label">Match Confidence</span>
            <span className="value">{(confidence_score * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>

      <div className="remediation-body">
        {/* Issue description */}
        <div className="issue-description">
          <label>Issue</label>
          <p>{description}</p>
        </div>

        {/* Fix steps */}
        {fix_steps && fix_steps.length > 0 && (
          <div className="fix-steps">
            <label>Resolution Steps</label>
            <ol className="steps-list">
              {fix_steps.map((step, idx) => (
                <li key={idx} className="step-item">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Estimated time */}
        {estimated_resolution_time && (
          <div className="estimated-time">
            <label>Est. Resolution Time</label>
            <span className="time-value">{estimated_resolution_time}</span>
          </div>
        )}

        {/* Category info */}
        {issue_category && (
          <div className="category-info">
            <span className="category-label">Category: {issue_category}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemediationGuidance;
