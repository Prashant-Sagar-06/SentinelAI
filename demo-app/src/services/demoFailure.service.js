/**
 * Demo Failure Service
 * Simulates realistic failure scenarios for AI anomaly detection training
 */

const simulateDatabaseTimeout = async () => {
    // Simulate database connection attempt with timeout
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const error = new Error("Database connection timeout after 30000ms");
    error.code = "ETIMEDOUT";
    error.host = "db.sentinelai.internal";
    error.port = 5432;
    throw error;
};

const simulateApiTimeout = async () => {
    // Simulate external API call with timeout
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const error = new Error("External API request timeout");
    error.code = "ECONNABORTED";
    error.endpoint = "https://api.external-service.com/v1/data";
    error.timeout = 10000;
    throw error;
};

const simulateHighMemoryUsage = () => {
    // Simulate high memory usage detection
    const memoryUsage = {
        heapUsed: 1800 * 1024 * 1024, // 1.8 GB
        heapTotal: 2048 * 1024 * 1024, // 2 GB
        threshold: 0.85,
        currentUsage: 0.88
    };
    
    return {
        warning: true,
        message: "Memory usage exceeded threshold",
        details: memoryUsage
    };
};

module.exports = {
    simulateDatabaseTimeout,
    simulateApiTimeout,
    simulateHighMemoryUsage
};
