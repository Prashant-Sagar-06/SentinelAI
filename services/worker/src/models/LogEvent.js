import mongoose from 'mongoose';

const LogEventSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true, index: true },
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

export const LogEvent = mongoose.model('LogEvent', LogEventSchema);
