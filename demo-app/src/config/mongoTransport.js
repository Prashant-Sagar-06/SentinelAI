const Transport = require("winston-transport");
const mongoose = require("mongoose");

/**
 * Custom Winston transport for MongoDB
 * Persists logs to MongoDB for AI anomaly detection
 */
class MongoTransport extends Transport {
    constructor(opts = {}) {
        super(opts);
        this.name = "MongoTransport";
        this.Log = null;
    }

    /**
     * Lazy load the Log model to avoid circular dependencies
     */
    getLogModel() {
        if (!this.Log) {
            this.Log = require("../models/log.model");
        }
        return this.Log;
    }

    /**
     * Core logging method called by Winston
     */
    async log(info, callback) {
        setImmediate(() => {
            this.emit("logged", info);
        });

        // Skip if MongoDB is not connected
        if (mongoose.connection.readyState !== 1) {
            return callback();
        }

        try {
            const Log = this.getLogModel();
            
            // Extract standard fields and put rest in metadata
            const { level, message, timestamp, service, ...metadata } = info;

            const logEntry = new Log({
                timestamp: timestamp ? new Date(timestamp) : new Date(),
                level: level,
                message: typeof message === "string" ? message : JSON.stringify(message),
                service: service || "SentinelAI Demo App",
                metadata: metadata
            });

            await logEntry.save();
        } catch (error) {
            // Silently fail to prevent logging errors from crashing the app
            // Console fallback for debugging
            console.error("MongoTransport error:", error.message);
        }

        callback();
    }
}

module.exports = MongoTransport;
