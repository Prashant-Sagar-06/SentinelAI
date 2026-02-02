/**
 * SentinelAI Dashboard - Dashboard Page
 * ======================================
 * 
 * Main dashboard overview page with statistics and recent data.
 */

import React from 'react';
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

/**
 * Format timestamp for display.
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Dashboard page component.
 */
export const DashboardPage = () => {
  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useStats();
  const { anomalies, loading: anomaliesLoading, error: anomaliesError } = useAnomalies({ limit: 5 });
  const { rootCauses, loading: rootCausesLoading, error: rootCausesError } = useRootCauses({ limit: 3 });

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
        <h1>Dashboard Overview</h1>
        <p>Real-time insights from AI-powered log analysis</p>
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
              value={stats?.anomalies?.total_count || 0}
              icon="⚠️"
              variant="warning"
            />
            <StatsCard 
              title="Root Causes"
              value={stats?.root_causes?.total_count || 0}
              icon="🔍"
              variant="primary"
            />
            <StatsCard 
              title="Services Affected"
              value={stats?.anomalies?.services_count || 0}
              icon="🖥️"
              variant="danger"
            />
            <StatsCard 
              title="Avg Confidence"
              value={stats?.root_causes?.avg_confidence 
                ? `${(stats.root_causes.avg_confidence * 100).toFixed(0)}%` 
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
