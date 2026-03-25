import mongoose from 'mongoose';

const AnomalySchema = new mongoose.Schema(
  {
    user_id: { type: String, default: null, index: true },
    type: { type: String, required: true, default: 'ANOMALY', index: true },
    // Source-of-truth minute bucket (matches metrics_minute.timestamp_minute)
    timestamp_minute: { type: Date, required: true, index: true },
    score: { type: Number, required: true, min: 0, max: 1, index: true },
    confidence: { type: Number, min: 0, max: 1, default: null, index: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'], index: true },
    message: { type: String, required: true },
    reason: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    alert_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', index: true },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

AnomalySchema.index({ user_id: 1, timestamp_minute: -1 });
AnomalySchema.index({ createdAt: -1, severity: 1 });
AnomalySchema.index({ type: 1, severity: 1, createdAt: -1 });
AnomalySchema.index({ timestamp_minute: -1, severity: 1 });

export const Anomaly = mongoose.model('Anomaly', AnomalySchema);
