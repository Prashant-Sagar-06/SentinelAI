/**
 * SentinelAI Dashboard - Dashboard Page
 * ======================================
 * 
 * Main dashboard overview page with statistics and recent data.
 * Features auto-refresh for real-time monitoring.
 */

import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useStats } from '../hooks/useStats';
import { useAnomalies } from '../hooks/useAnomalies';
import { useRootCauses } from '../hooks/useRootCauses';
import StatsCard from '../components/StatsCard';
import DataTable from '../components/DataTable';
import ScoreBadge from '../components/ScoreBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import './DashboardPage.css';

// Auto-refresh interval in milliseconds (30 seconds)
const AUTO_REFRESH_INTERVAL = 30000;

/**
 * Format timestamp for display.
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Format relative time for "last updated" display.
 */
const formatRelativeTime = (date) => {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return date.toLocaleTimeString();
};

/**
 * Dashboard page component.
 */
export const DashboardPage = () => {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useStats({ 
    autoRefresh: true, 
    refreshInterval: AUTO_REFRESH_INTERVAL 
  });
  const { anomalies, loading: anomaliesLoading, error: anomaliesError, refetch: refetchAnomalies } = useAnomalies({ 
    limit: 5, 
    autoRefresh: true, 
    refreshInterval: AUTO_REFRESH_INTERVAL 
  });
  const { rootCauses, loading: rootCausesLoading, error: rootCausesError, refetch: refetchRootCauses } = useRootCauses({ 
    limit: 3, 
    autoRefresh: true, 
    refreshInterval: AUTO_REFRESH_INTERVAL 
  });

  /**
   * Manual refresh handler - refreshes all data.
   */
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchStats(), refetchAnomalies(), refetchRootCauses()]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, [refetchStats, refetchAnomalies, refetchRootCauses]);

  const loading = statsLoading || anomaliesLoading || rootCausesLoading;
  
  // Anomaly table columns
  const anomalyColumns = [
    { key: 'timestamp', label: 'Time', render: (val) => formatTimestamp(val) },
    { key: 'service', label: 'Service' },
    { key: 'anomaly_score', label: 'Score', render: (val) => <ScoreBadge score={val} /> },
  ];

  // Root cause table columns
  const rootCauseColumns = [
    { key: 'root_cause_service', label: 'Root Cause' },
    { key: 'confidence_score', label: 'Confidence', render: (val) => <ScoreBadge score={val} /> },
    { key: 'affected_services_count', label: 'Affected', render: (_, row) => 
      `${row.affected_services?.length || 0} services` 
    },
  ];

  if (loading) {
    return <Loading message="Loading dashboard..." />;
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div className="page-header-content">
          <h1>Dashboard Overview</h1>
          <p>Real-time insights from AI-powered log analysis</p>
        </div>
        <div className="page-header-actions">
          <span className="last-updated">
            Last updated: {formatRelativeTime(lastUpdated)}
          </span>
          <button 
            className={`refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Refresh data"
          >
            {isRefreshing ? '↻ Syncing...' : '↻ Refresh'}
          </button>
        </div>
      </header>

      {/* Stats Section */}
      <section className="stats-section">
        {statsError ? (
          <ErrorMessage 
            title="Failed to load statistics" 
            message={statsError}
            onRetry={refetchStats}
          />
        ) : (
          <div className="stats-grid">
            <StatsCard 
              title="Total Anomalies"
              value={stats?.anomalies?.total_anomalies || 0}
              icon="⚠️"
              variant="warning"
            />
            <StatsCard 
              title="Root Causes"
              value={stats?.root_causes?.total_root_causes || 0}
              icon="🔍"
              variant="primary"
            />
            <StatsCard 
              title="Services Affected"
              value={Object.keys(stats?.anomalies?.by_service || {}).length}
              icon="🖥️"
              variant="danger"
            />
            <StatsCard 
              title="Avg Confidence"
              value={stats?.root_causes?.average_confidence 
                ? `${(stats.root_causes.average_confidence * 100).toFixed(0)}%` 
                : 'N/A'}
              icon="📊"
              variant="success"
            />
          </div>
        )}
      </section>

      {/* Recent Data Section */}
      <div className="dashboard-grid">
        {/* Recent Anomalies */}
        <section className="dashboard-card">
          <div className="card-header">
            <h2>Recent Anomalies</h2>
            <Link to="/anomalies" className="view-all-link">View All →</Link>
          </div>
          {anomaliesError ? (
            <ErrorMessage title="Failed to load anomalies" message={anomaliesError} />
          ) : (
            <DataTable 
              columns={anomalyColumns}
              data={anomalies}
              emptyMessage="No anomalies detected yet"
            />
          )}
        </section>

        {/* Recent Root Causes */}
        <section className="dashboard-card">
          <div className="card-header">
            <h2>Recent Root Causes</h2>
            <Link to="/root-causes" className="view-all-link">View All →</Link>
          </div>
          {rootCausesError ? (
            <ErrorMessage title="Failed to load root causes" message={rootCausesError} />
          ) : (
            <DataTable 
              columns={rootCauseColumns}
              data={rootCauses}
              emptyMessage="No root causes identified yet"
            />
          )}
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
