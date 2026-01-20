const logger = require("../config/logger");
const demoFailureService = require("../services/demoFailure.service");

const SERVICE_NAME = "SentinelAI Demo App";

exports.triggerDbFailure = async (req, res) => {
    const timestamp = new Date().toISOString();
    
    try {
        await demoFailureService.simulateDatabaseTimeout();
    } catch (error) {
        logger.error({
            service: SERVICE_NAME,
            failureType: "DATABASE_CONNECTION_TIMEOUT",
            timestamp,
            error: {
                message: error.message,
                code: error.code,
                host: error.host,
                port: error.port
            }
        });

        return res.status(503).json({
            status: "error",
            message: "Database connection failed",
            errorCode: "DB_TIMEOUT",
            timestamp
        });
    }
};

exports.triggerApiTimeout = async (req, res) => {
    const timestamp = new Date().toISOString();
    
    try {
        await demoFailureService.simulateApiTimeout();
    } catch (error) {
        logger.error({
            service: SERVICE_NAME,
            failureType: "EXTERNAL_API_TIMEOUT",
            timestamp,
            error: {
                message: error.message,
                code: error.code,
                endpoint: error.endpoint,
                timeout: error.timeout
            }
        });

        return res.status(504).json({
            status: "error",
            message: "External API request timed out",
            errorCode: "API_TIMEOUT",
            timestamp
        });
    }
};

exports.triggerMemoryWarning = (req, res) => {
    const timestamp = new Date().toISOString();
    
    const memoryStatus = demoFailureService.simulateHighMemoryUsage();

    logger.warn({
        service: SERVICE_NAME,
        failureType: "HIGH_MEMORY_USAGE",
        timestamp,
        warning: {
            message: memoryStatus.message,
            heapUsedMB: Math.round(memoryStatus.details.heapUsed / (1024 * 1024)),
            heapTotalMB: Math.round(memoryStatus.details.heapTotal / (1024 * 1024)),
            usagePercent: Math.round(memoryStatus.details.currentUsage * 100),
            threshold: Math.round(memoryStatus.details.threshold * 100)
        }
    });

    return res.status(200).json({
        status: "warning",
        message: "High memory usage detected",
        warningCode: "MEMORY_THRESHOLD_EXCEEDED",
        details: {
            usagePercent: Math.round(memoryStatus.details.currentUsage * 100),
            thresholdPercent: Math.round(memoryStatus.details.threshold * 100)
        },
        timestamp
    });
};
