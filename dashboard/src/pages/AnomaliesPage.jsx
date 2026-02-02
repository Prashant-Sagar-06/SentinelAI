/**
 * SentinelAI Dashboard - Anomalies Page
 * ======================================
 * 
 * Full-featured page for viewing and filtering detected anomalies.
 */

import React, { useState } from 'react';
import { useAnomalies } from '../hooks/useAnomalies';
import DataTable from '../components/DataTable';
import ScoreBadge from '../components/ScoreBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import './AnomaliesPage.css';

/**
 * Format timestamp for display.
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Truncate long text with ellipsis.
 */
const truncateText = (text, maxLength = 100) => {
  if (!text) return 'N/A';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Anomalies page component.
 */
export const AnomaliesPage = () => {
  // Filter state
  const [limit, setLimit] = useState(20);
  const [minScore, setMinScore] = useState(0);
  const [service, setService] = useState('');
  const [hours, setHours] = useState(24);

  // Fetch anomalies with filters
  const { anomalies, count, loading, error, refetch } = useAnomalies({
    limit,
    minScore: minScore > 0 ? minScore : undefined,
    service: service || undefined,
    hours,
  });

  // Table columns
  const columns = [
    { 
      key: 'timestamp', 
      label: 'Timestamp', 
      className: 'col-medium',
      render: (val) => formatTimestamp(val) 
    },
    { 
      key: 'service', 
      label: 'Service',
      className: 'col-narrow',
    },
    { 
      key: 'message', 
      label: 'Log Message',
      className: 'col-wide',
      render: (val) => (
        <span className="log-message" title={val}>
          {truncateText(val, 80)}
        </span>
      )
    },
    { 
      key: 'anomaly_score', 
      label: 'Score',
      className: 'col-narrow',
      render: (val) => <ScoreBadge score={val} />
    },
    { 
      key: 'reconstruction_error', 
      label: 'Error',
      className: 'col-narrow',
      render: (val) => val?.toFixed(4) || 'N/A'
    },
  ];

  return (
    <div className="anomalies-page">
      <header className="page-header">
        <div>
          <h1>Anomaly Detection</h1>
          <p>View and filter detected anomalies from log analysis</p>
        </div>
        <button className="refresh-btn" onClick={refetch} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </header>

      {/* Filters */}
      <section className="filters-section">
        <div className="filter-group">
          <label htmlFor="hours">Time Range</label>
          <select 
            id="hours" 
            value={hours} 
            onChange={(e) => setHours(Number(e.target.value))}
          >
            <option value={1}>Last hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last week</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="minScore">Min Score</label>
          <input 
            type="range" 
            id="minScore"
            min="0" 
            max="1" 
            step="0.1" 
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
          />
          <span className="range-value">{(minScore * 100).toFixed(0)}%</span>
        </div>

        <div className="filter-group">
          <label htmlFor="service">Service</label>
          <input 
            type="text" 
            id="service"
            placeholder="Filter by service..."
            value={service}
            onChange={(e) => setService(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="limit">Results</label>
          <select 
            id="limit" 
            value={limit} 
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </section>

      {/* Results count */}
      {!loading && !error && (
        <div className="results-info">
          Showing <strong>{anomalies.length}</strong> of <strong>{count}</strong> anomalies
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Loading message="Loading anomalies..." />
      ) : error ? (
        <ErrorMessage 
          title="Failed to load anomalies" 
          message={error}
          onRetry={refetch}
        />
      ) : (
        <DataTable 
          columns={columns}
          data={anomalies}
          emptyMessage="No anomalies found matching your filters"
        />
      )}
    </div>
  );
};

export default AnomaliesPage;
