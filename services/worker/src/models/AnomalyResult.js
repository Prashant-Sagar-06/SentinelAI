import mongoose from 'mongoose';

const AnomalyResultSchema = new mongoose.Schema(
  {
    event_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'LogEvent' },
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

export const AnomalyResult = mongoose.model('AnomalyResult', AnomalyResultSchema);
