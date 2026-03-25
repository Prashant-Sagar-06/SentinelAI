import mongoose from 'mongoose';

const ResponseSchema = new mongoose.Schema(
  {
    user_id: { type: String, default: null, index: true },
    anomaly_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Anomaly', required: true, index: true },
    // Optional: align response with metrics/anomaly minute bucket.
    timestamp_minute: { type: Date, default: null, index: true },
    action: {
      type: String,
      required: true,
      enum: ['BLOCK_IP', 'RATE_LIMIT_IP', 'RAISE_ALERT', 'RAISE_CRITICAL_ALERT', 'LOG_INCIDENT'],
      index: true,
    },
    target: { type: String, default: null, index: true },
    status: { type: String, required: true, enum: ['executed', 'failed', 'skipped'], default: 'executed', index: true },
    message: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

// Idempotency: each anomaly/action/target should be recorded at most once.
// Sparse keeps legacy docs (missing target) from conflicting.
ResponseSchema.index({ anomaly_id: 1, action: 1, target: 1 }, { unique: true, sparse: true });
ResponseSchema.index({ user_id: 1, anomaly_id: 1, createdAt: -1 });
ResponseSchema.index({ createdAt: -1, action: 1 });
ResponseSchema.index({ timestamp_minute: -1, action: 1 });

export const Response = mongoose.model('Response', ResponseSchema, 'responses');
