/**
 * SentinelAI Dashboard - API Service Layer
 * =========================================
 * 
 * This module provides a configured API client for communicating
 * with the SentinelAI FastAPI backend. All API calls go through
 * this layer to ensure consistent error handling and configuration.
 * 
 * WHY A SERVICE LAYER?
 * --------------------
 * 1. Centralized configuration (baseURL, headers, timeouts)
 * 2. Consistent error handling across all API calls
 * 3. Easy to mock for testing
 * 4. Single place to add authentication later
 */

import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

const API_TIMEOUT = 30000; // 30 seconds (safe for cold start)


/**
 * Configured axios instance for API calls.
 * All requests go through this client.
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor for logging and debugging.
 * Useful for adding auth tokens later.
 */
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for consistent error handling.
 * Transforms API errors into user-friendly messages.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail 
      || error.response?.data?.message 
      || error.message 
      || 'An unexpected error occurred';
    
    console.error('[API] Response error:', message);
    
    return Promise.reject({
      message,
      status: error.response?.status,
      original: error,
    });
  }
);

/**
 * Fetch recent anomalies from the API.
 * 
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Max results (default: 20)
 * @param {string} params.service - Filter by service name
 * @param {number} params.min_score - Minimum anomaly score (0-1)
 * @param {number} params.hours - Only anomalies from last N hours
 * @returns {Promise<Object>} Response with count and anomalies array
 */
export const fetchAnomalies = async (params = {}) => {
  try {
    const response = await apiClient.get('/anomalies', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Fetch recent root cause analyses from the API.
 * 
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Max results (default: 5)
 * @param {number} params.min_confidence - Minimum confidence (0-1)
 * @param {string} params.service - Filter by root cause service
 * @returns {Promise<Object>} Response with count and root_causes array
 */
export const fetchRootCauses = async (params = {}) => {
  try {
    const response = await apiClient.get('/root-causes', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Fetch statistics from the API.
 * 
 * @returns {Promise<Object>} Statistics for anomalies and root causes
 */
export const fetchStats = async () => {
  try {
    const response = await apiClient.get('/stats');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Check API health status.
 * 
 * @returns {Promise<Object>} Health status response
 */
export const checkHealth = async () => {
  try {
    // Health endpoint is at root level, not /api/v1
    const response = await axios.get('http://localhost:8000/health', {
      timeout: 5000,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default apiClient;
