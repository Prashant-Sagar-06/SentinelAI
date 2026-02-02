/**
 * SentinelAI Dashboard - Loading Spinner Component
 * =================================================
 * 
 * A simple, accessible loading spinner for async operations.
 */

import React from 'react';
import './Loading.css';

/**
 * Loading spinner component with optional message.
 * 
 * @param {Object} props
 * @param {string} props.message - Optional loading message
 * @param {string} props.size - Spinner size: 'sm', 'md', 'lg' (default: 'md')
 */
export const Loading = ({ message = 'Loading...', size = 'md' }) => {
  return (
    <div className={`loading-container loading-${size}`} role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default Loading;
