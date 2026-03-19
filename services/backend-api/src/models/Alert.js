import mongoose from 'mongoose';

const AlertSchema = new mongoose.Schema(
  {
    event_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'LogEvent' },
    title: { type: String, required: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'], index: true },
    status: { type: String, required: true, enum: ['open', 'ack', 'closed'], default: 'open', index: true },
    threat_type: { type: String, required: true, index: true },
    group_key: { type: String, required: true, index: true },
    reason: { type: String, required: true },
    source_ip: { type: String, index: true },
    threat_intel: {
      reputation: { type: String, enum: ['malicious', 'unknown'], default: 'unknown' },
      country: { type: String, default: 'Unknown' },
      provider: { type: String, default: 'local-feed' },
    },
    actor: { type: String, index: true },

    assigned_to: { type: String, default: null, index: true },
    assigned_at: { type: Date, default: null },

    // Dedup/grouping fields
    event_count: { type: Number, default: 1 },
    first_seen: { type: Date, default: () => new Date() },
    last_seen: { type: Date, default: () => new Date(), index: true },
    window_start: { type: Date, index: true },

    counts: {
      occurrences: { type: Number, default: 1 },
      first_seen_at: { type: Date, default: () => new Date() },
      last_seen_at: { type: Date, default: () => new Date() },
    },
    createdAt: { type: Date, default: () => new Date(), index: true },
    updatedAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

AlertSchema.index({ group_key: 1, status: 1, severity: 1 });
AlertSchema.index({ group_key: 1, status: 1, createdAt: -1 });
AlertSchema.index({ group_key: 1, status: 1, window_start: 1 }, { unique: true, sparse: true });

export const Alert = mongoose.model('Alert', AlertSchema);
