import mongoose from 'mongoose';

const IncidentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'], index: true },
    status: {
      type: String,
      required: true,
      enum: ['open', 'investigating', 'resolved'],
      default: 'open',
      index: true,
    },
    alerts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Alert' }],
    actors: [{ type: String, index: true }],
    source_ips: [{ type: String, index: true }],
    first_seen: { type: Date, index: true },
    last_seen: { type: Date, index: true },
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);

IncidentSchema.index({ status: 1, severity: 1 });
IncidentSchema.index({ actors: 1 });
IncidentSchema.index({ source_ips: 1 });

export const Incident = mongoose.model('Incident', IncidentSchema);
