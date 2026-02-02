/**
 * SentinelAI Dashboard - Stats Card Component
 * ============================================
 * 
 * A card component for displaying statistics.
 */

import React from 'react';
import './StatsCard.css';

/**
 * Stats card for displaying metric values.
 * 
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {string|number} props.value - Main value to display
 * @param {string} props.subtitle - Optional subtitle
 * @param {string} props.icon - Optional icon (emoji or text)
 * @param {string} props.variant - Color variant: 'primary', 'success', 'warning', 'danger'
 */
export const StatsCard = ({ 
  title, 
  value, 
  subtitle, 
  icon,
  variant = 'primary' 
}) => {
  return (
    <div className={`stats-card stats-${variant}`}>
      {icon && <div className="stats-icon">{icon}</div>}
      <div className="stats-content">
        <h4 className="stats-title">{title}</h4>
        <p className="stats-value">{value}</p>
        {subtitle && <span className="stats-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
};

export default StatsCard;
