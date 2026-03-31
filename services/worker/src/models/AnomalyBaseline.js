import mongoose from 'mongoose';

const AnomalyBaselineSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    mean: { type: Number, required: true },
    std: { type: Number, required: true },
    n: { type: Number, default: null },
    last_updated: { type: Date, required: true, index: true },
    createdAt: { type: Date, default: () => new Date(), index: true },
    updatedAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

AnomalyBaselineSchema.index({ key: 1 }, { unique: true });

export const AnomalyBaseline = mongoose.model('AnomalyBaseline', AnomalyBaselineSchema, 'anomaly_baselines');
