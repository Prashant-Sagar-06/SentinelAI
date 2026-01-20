const mongoose = require("mongoose");

/**
 * Connect to MongoDB
 * @param {Object} logger - Winston logger instance (optional, to avoid circular dependency)
 */
const connectDB = async (logger = null) => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        
        if (logger) {
            logger.info({
                message: "MongoDB connected successfully",
                host: conn.connection.host,
                database: conn.connection.name
            });
        }
        
        return conn;
    } catch (error) {
        if (logger) {
            logger.error({
                message: "MongoDB connection failed",
                error: error.message
            });
        }
        // Don't exit process - allow app to continue with file/console logging
        console.error("MongoDB connection failed:", error.message);
    }
};

module.exports = connectDB;
