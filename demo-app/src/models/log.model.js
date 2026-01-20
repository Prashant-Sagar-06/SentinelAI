const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        required: true,
        index: true
    },
    level: {
        type: String,
        enum: ["info", "warn", "error"],
        required: true,
        index: true
    },
    message: {
        type: String,
        default: ""
    },
    service: {
        type: String,
        default: "SentinelAI Demo App"
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for efficient querying by time range and level
logSchema.index({ timestamp: -1, level: 1 });

const Log = mongoose.model("Log", logSchema);

module.exports = Log;
