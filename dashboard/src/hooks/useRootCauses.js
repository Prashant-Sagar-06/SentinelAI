/**
 * SentinelAI Dashboard - useRootCauses Hook
 * ==========================================
 * 
 * Custom React hook for fetching and managing root cause analysis data.
 * Handles loading states, errors, and automatic refetching.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchRootCauses } from '../services/api';

/**
 * Hook for managing root cause data from the API.
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Maximum root causes to fetch (default: 5)
 * @param {number} options.minConfidence - Minimum confidence (0-1)
 * @param {string} options.service - Filter by root cause service
 * @param {boolean} options.autoRefresh - Enable auto-refresh (default: false)
 * @param {number} options.refreshInterval - Refresh interval in ms (default: 30000)
 * @returns {Object} { rootCauses, count, loading, error, refetch }
 */
export const useRootCauses = (options = {}) => {
  const {
    limit = 5,
    minConfidence,
    service,
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  // State management
  const [rootCauses, setRootCauses] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetch root causes from the API.
   * Wrapped in useCallback to prevent unnecessary re-renders.
   */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params, omitting undefined values
      const params = {
        limit,
        ...(minConfidence !== undefined && { min_confidence: minConfidence }),
        ...(service && { service }),
      };

      const response = await fetchRootCauses(params);
      
      setRootCauses(response.root_causes || []);
      setCount(response.count || 0);
    } catch (err) {
      console.error('[useRootCauses] Fetch error:', err);
      setError(err.message || 'Failed to fetch root causes');
      setRootCauses([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [limit, minConfidence, service]);

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
    rootCauses,
    count,
    loading,
    error,
    refetch,
  };
};

export default useRootCauses;
