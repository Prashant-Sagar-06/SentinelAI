/**
 * SentinelAI Dashboard - Error Message Component
 * ===============================================
 * 
 * A user-friendly error message display component.
 */

import React from 'react';
import './ErrorMessage.css';

/**
 * Error message component with optional retry action.
 * 
 * @param {Object} props
 * @param {string} props.title - Error title
 * @param {string} props.message - Error message
 * @param {Function} props.onRetry - Optional retry callback
 */
export const ErrorMessage = ({ 
  title = 'Something went wrong', 
  message = 'An unexpected error occurred. Please try again.',
  onRetry 
}) => {
  return (
    <div className="error-container" role="alert">
      <div className="error-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="error-title">{title}</h3>
      <p className="error-message">{message}</p>
      {onRetry && (
        <button className="error-retry-btn" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
