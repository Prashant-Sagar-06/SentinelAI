import mongoose from 'mongoose';

const AnomalyResultSchema = new mongoose.Schema(
  {
    user_id: { type: String, default: null, index: true },
    event_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'LogEvent' },
    // Minute bucket for easier joins/debugging (derived from LogEvent.timestamp)
    timestamp_minute: { type: Date, default: null, index: true },
    model_version: { type: String, required: true },
    anomaly_score: { type: Number, required: true },
    risk_score: { type: Number, required: true },
    risk_level: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'], index: true },
    threat_type: { type: String, required: true, index: true },
    explanations: [{ type: String }],
    features: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

AnomalyResultSchema.index({ user_id: 1, event_id: 1 });
AnomalyResultSchema.index({ user_id: 1, timestamp_minute: -1 });

export const AnomalyResult = mongoose.model('AnomalyResult', AnomalyResultSchema);
