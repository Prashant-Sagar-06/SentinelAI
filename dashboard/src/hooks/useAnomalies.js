/**
 * SentinelAI Dashboard - useAnomalies Hook
 * =========================================
 * 
 * Custom React hook for fetching and managing anomaly data.
 * Handles loading states, errors, and automatic refetching.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchAnomalies } from '../services/api';

/**
 * Hook for managing anomaly data from the API.
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Maximum anomalies to fetch (default: 20)
 * @param {string} options.service - Filter by service name
 * @param {number} options.minScore - Minimum anomaly score (0-1)
 * @param {number} options.hours - Only anomalies from last N hours
 * @param {boolean} options.autoRefresh - Enable auto-refresh (default: false)
 * @param {number} options.refreshInterval - Refresh interval in ms (default: 30000)
 * @returns {Object} { anomalies, count, loading, error, refetch }
 */
export const useAnomalies = (options = {}) => {
  const {
    limit = 20,
    service,
    minScore,
    hours,
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  // State management
  const [anomalies, setAnomalies] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetch anomalies from the API.
   * Wrapped in useCallback to prevent unnecessary re-renders.
   */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params, omitting undefined values
      const params = {
        limit,
        ...(service && { service }),
        ...(minScore !== undefined && { min_score: minScore }),
        ...(hours !== undefined && { hours }),
      };

      const response = await fetchAnomalies(params);
      
      setAnomalies(response.anomalies || []);
      setCount(response.count || 0);
    } catch (err) {
      console.error('[useAnomalies] Fetch error:', err);
      setError(err.message || 'Failed to fetch anomalies');
      setAnomalies([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [limit, service, minScore, hours]);

  /**
   * Manual refetch function.
   * Call this to manually refresh data.
   */
  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Initial fetch and dependency-based refetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(fetchData, refreshInterval);
    
    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchData]);

  return {
    anomalies,
    count,
    loading,
    error,
    refetch,
  };
};

export default useAnomalies;
