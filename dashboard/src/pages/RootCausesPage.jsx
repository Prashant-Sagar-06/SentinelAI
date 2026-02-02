/**
 * SentinelAI Dashboard - Root Causes Page
 * ========================================
 * 
 * Page for viewing root cause analysis results.
 */

import React, { useState } from 'react';
import { useRootCauses } from '../hooks/useRootCauses';
import DataTable from '../components/DataTable';
import ScoreBadge from '../components/ScoreBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import './RootCausesPage.css';

/**
 * Format timestamp for display.
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Root causes page component.
 */
export const RootCausesPage = () => {
  // Filter state
  const [limit, setLimit] = useState(10);
  const [minConfidence, setMinConfidence] = useState(0);
  const [service, setService] = useState('');

  // Fetch root causes with filters
  const { rootCauses, count, loading, error, refetch } = useRootCauses({
    limit,
    minConfidence: minConfidence > 0 ? minConfidence : undefined,
    service: service || undefined,
  });

  // Table columns
  const columns = [
    { 
      key: 'analysis_timestamp', 
      label: 'Analyzed At', 
      className: 'col-medium',
      render: (val) => formatTimestamp(val) 
    },
    { 
      key: 'root_cause_service', 
      label: 'Root Cause Service',
      className: 'col-medium',
      render: (val) => (
        <span className="root-cause-service">{val || 'Unknown'}</span>
      )
    },
    { 
      key: 'confidence_score', 
      label: 'Confidence',
      className: 'col-narrow',
      render: (val) => <ScoreBadge score={val} />
    },
    { 
      key: 'affected_services', 
      label: 'Affected Services',
      className: 'col-wide',
      render: (val) => (
        <div className="affected-services">
          {val && val.length > 0 ? (
            val.map((svc, idx) => (
              <span key={idx} className="service-tag">{svc}</span>
            ))
          ) : (
            <span className="no-services">None identified</span>
          )}
        </div>
      )
    },
    { 
      key: 'total_anomalies', 
      label: 'Anomalies',
      className: 'col-narrow',
      render: (val) => val || 0
    },
  ];

  return (
    <div className="root-causes-page">
      <header className="page-header">
        <div>
          <h1>Root Cause Analysis</h1>
          <p>AI-identified root causes of detected anomalies</p>
        </div>
        <button className="refresh-btn" onClick={refetch} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </header>

      {/* Filters */}
      <section className="filters-section">
        <div className="filter-group">
          <label htmlFor="minConfidence">Min Confidence</label>
          <input 
            type="range" 
            id="minConfidence"
            min="0" 
            max="1" 
            step="0.1" 
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
          />
          <span className="range-value">{(minConfidence * 100).toFixed(0)}%</span>
        </div>

        <div className="filter-group">
          <label htmlFor="service">Root Cause Service</label>
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
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </section>

      {/* Results count */}
      {!loading && !error && (
        <div className="results-info">
          Showing <strong>{rootCauses.length}</strong> of <strong>{count}</strong> root cause analyses
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Loading message="Loading root cause analyses..." />
      ) : error ? (
        <ErrorMessage 
          title="Failed to load root causes" 
          message={error}
          onRetry={refetch}
        />
      ) : (
        <>
          <DataTable 
            columns={columns}
            data={rootCauses}
            emptyMessage="No root causes found matching your filters"
          />
          
          {/* Expanded view for root cause details */}
          {rootCauses.length > 0 && (
            <section className="details-section">
              <h2>Analysis Details</h2>
              {rootCauses.map((rc, idx) => (
                <div key={rc._id || idx} className="root-cause-detail">
                  <div className="detail-header">
                    <h3>
                      <span className="detail-number">#{idx + 1}</span>
                      {rc.root_cause_service || 'Unknown Service'}
                    </h3>
                    <ScoreBadge score={rc.confidence_score} label="Confidence" />
                  </div>
                  
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Total Anomalies</label>
                      <span>{rc.total_anomalies || 0}</span>
                    </div>
                    <div className="detail-item">
                      <label>Unique Services</label>
                      <span>{rc.unique_services || 0}</span>
                    </div>
                    <div className="detail-item">
                      <label>Avg Anomaly Score</label>
                      <span>{(rc.avg_anomaly_score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="detail-item">
                      <label>Analyzed</label>
                      <span>{formatTimestamp(rc.analysis_timestamp)}</span>
                    </div>
                  </div>
                  
                  {rc.affected_services && rc.affected_services.length > 0 && (
                    <div className="detail-services">
                      <label>Affected Services</label>
                      <div className="service-tags">
                        {rc.affected_services.map((svc, i) => (
                          <span key={i} className="service-tag">{svc}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default RootCausesPage;
