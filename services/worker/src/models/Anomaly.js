import mongoose from 'mongoose';

const AnomalySchema = new mongoose.Schema(
  {
    type: { type: String, required: true, default: 'ANOMALY', index: true },
    score: { type: Number, required: true, min: 0, max: 1, index: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'], index: true },
    message: { type: String, required: true },
    reason: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    alert_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', index: true },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

AnomalySchema.index({ createdAt: -1, severity: 1 });

export const Anomaly = mongoose.model('Anomaly', AnomalySchema);
