/**
 * SentinelAI Dashboard - useStats Hook
 * =====================================
 * 
 * Custom React hook for fetching dashboard statistics.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchStats } from '../services/api';

/**
 * Hook for fetching dashboard statistics.
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoRefresh - Enable auto-refresh (default: false)
 * @param {number} options.refreshInterval - Refresh interval in ms (default: 60000)
 * @returns {Object} { stats, loading, error, refetch }
 */
export const useStats = (options = {}) => {
  const {
    autoRefresh = false,
    refreshInterval = 60000,
  } = options;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchStats();
      setStats(response);
    } catch (err) {
      console.error('[useStats] Fetch error:', err);
      setError(err.message || 'Failed to fetch statistics');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(fetchData, refreshInterval);
    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchData]);

  return {
    stats,
    loading,
    error,
    refetch,
  };
};

export default useStats;
