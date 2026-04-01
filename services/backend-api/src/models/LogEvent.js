import mongoose from 'mongoose';
import { config } from '../config.js';

const ONE_MINUTE_MS = 60_000;

function floorToUtcMinute(date) {
  if (!date) return null;
  const ms = new Date(date).getTime();
  if (Number.isNaN(ms)) return null;
  return new Date(Math.floor(ms / ONE_MINUTE_MS) * ONE_MINUTE_MS);
}

const LogEventSchema = new mongoose.Schema(
  {
    user_id: { type: String, default: null, index: true },

    timestamp: {
      type: Date,
      required: true,
      index: true,
    },

    // auto-generated minute bucket
    timestamp_minute: {
      type: Date,
      index: true,
    },

    source: {
      type: String,
      required: true,
      index: true,
    },

    event_type: {
      type: String,
      required: true,
      index: true,
    },

    message: { type: String },

    status: { type: String, index: true },

    severity_hint: { type: String },

    tenant_id: {
      type: String,
      default: 'default',
      index: true,
    },

    ingest_id: {
      type: String,
      index: true,
    },

    actor: {
      user: { type: String, index: true },
      service: { type: String, index: true },
      role: { type: String },
    },

    network: {
      ip: { type: String, index: true },
      user_agent: { type: String },
    },

    attributes: { type: mongoose.Schema.Types.Mixed },
    tags: [{ type: String }],

    raw: { type: mongoose.Schema.Types.Mixed },

    analysis_status: {
      type: String,
      enum: ['pending', 'done', 'error'],
      default: 'pending',
      index: true,
    },

    createdAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
  },
  { versionKey: false }
);

/* =========================
   AUTO DERIVED FIELDS
========================= */

LogEventSchema.pre('save', function (next) {
  if (this.timestamp) {
    this.timestamp_minute = floorToUtcMinute(this.timestamp);
  }
  next();
});

/* =========================
   INDEXES (OPTIMIZED)
========================= */

// Dashboard queries
LogEventSchema.index({ user_id: 1, timestamp: -1 });

// Aggregation / metrics
LogEventSchema.index({ user_id: 1, timestamp_minute: -1 });

// Global time queries
LogEventSchema.index({ timestamp_minute: -1 });

// 🔥 Idempotency protection
LogEventSchema.index(
  { tenant_id: 1, ingest_id: 1 },
  {
    unique: true,
    partialFilterExpression: { ingest_id: { $exists: true, $ne: null } },
  }
);

// TTL (only if configured)
if (config.logTtlSeconds && config.logTtlSeconds > 0) {
  LogEventSchema.index(
    { timestamp: 1 },
    { expireAfterSeconds: config.logTtlSeconds }
  );
}

export const LogEvent = mongoose.model('LogEvent', LogEventSchema);