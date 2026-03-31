import mongoose from 'mongoose';

import { config } from '../config.js';

const LogEventSchema = new mongoose.Schema(
  {
    user_id: { type: String, default: null, index: true },
    timestamp: { type: Date, required: true },
    // Canonical minute bucket derived from timestamp (UTC floored)
    timestamp_minute: { type: Date, default: null, index: true },
    source: { type: String, required: true, index: true },
    event_type: { type: String, required: true, index: true },
    message: { type: String },
    status: { type: String, index: true },
    severity_hint: { type: String },
    tenant_id: { type: String, default: 'default', index: true },
    ingest_id: { type: String, index: true },
    actor: {
      user: { type: String, index: true },
      service: { type: String },
      role: { type: String },
    },
    network: {
      ip: { type: String, index: true },
      user_agent: { type: String },
    },
    attributes: { type: mongoose.Schema.Types.Mixed },
    tags: [{ type: String }],

    raw: { type: mongoose.Schema.Types.Mixed },
    analysis_status: { type: String, enum: ['pending', 'done', 'error'], default: 'pending', index: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);

LogEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: config.logTtlSeconds });

LogEventSchema.index({ user_id: 1, timestamp: -1 });
LogEventSchema.index({ user_id: 1, timestamp_minute: -1 });
LogEventSchema.index({ timestamp_minute: -1 });

export const LogEvent = mongoose.model('LogEvent', LogEventSchema);
