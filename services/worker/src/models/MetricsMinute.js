import mongoose from 'mongoose';

import { config } from '../config.js';

const MetricsMinuteSchema = new mongoose.Schema(
  {
    user_id: { type: String, default: null, index: true },
    timestamp_minute: { type: Date, required: true },
    requests: { type: Number, required: true },
    avg_latency: { type: Number, required: true },
    error_rate: { type: Number, required: true },
    unique_ips: { type: Number, required: true },
    createdAt: { type: Date, default: () => new Date(), index: true },
    updatedAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

// Keep minute buckets unique per user.
// Also satisfies required index: { user_id: 1, timestamp_minute: -1 }
MetricsMinuteSchema.index({ user_id: 1, timestamp_minute: -1 }, { unique: true });

// Retention via TTL.
MetricsMinuteSchema.index({ createdAt: 1 }, { expireAfterSeconds: config.metricsTtlSeconds });

export const MetricsMinute = mongoose.model('MetricsMinute', MetricsMinuteSchema, 'metrics_minute');
