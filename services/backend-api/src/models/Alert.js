import mongoose from 'mongoose';

const ONE_MINUTE_MS = 60_000;

function floorToMinute(date) {
  if (!date) return null;
  const ms = new Date(date).getTime();
  if (Number.isNaN(ms)) return null;
  return new Date(Math.floor(ms / ONE_MINUTE_MS) * ONE_MINUTE_MS);
}

const AlertSchema = new mongoose.Schema(
  {
    user_id: { type: String, default: null, index: true },

    event_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'LogEvent',
    },

    timestamp_minute: { type: Date, default: null, index: true },

    // Intelligent Alert Engine
    type: { type: String, index: true },
    message: { type: String },

    metadata: { type: mongoose.Schema.Types.Mixed },

    title: { type: String, required: true },

    severity: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'critical'],
      index: true,
    },

    status: {
      type: String,
      required: true,
      enum: ['open', 'ack', 'closed', 'resolved'],
      default: 'open',
      index: true,
    },

    threat_type: { type: String, required: true, index: true },

    group_key: { type: String, required: true, index: true },

    reason: { type: String, required: true },

    source_ip: { type: String, index: true },

    threat_intel: {
      reputation: {
        type: String,
        enum: ['malicious', 'unknown'],
        default: 'unknown',
      },
      country: { type: String, default: 'Unknown' },
      provider: { type: String, default: 'local-feed' },
    },

    actor: { type: String, index: true },

    assigned_to: { type: String, default: null, index: true },
    assigned_at: { type: Date, default: null },

    // Dedup/grouping
    event_count: { type: Number, default: 1 },

    first_seen: {
      type: Date,
      default: () => new Date(),
      index: true,
    },

    last_seen: {
      type: Date,
      default: () => new Date(),
      index: true,
    },

    window_start: {
      type: Date,
      index: true,
    },

    counts: {
      occurrences: { type: Number, default: 1 },
      first_seen_at: { type: Date, default: () => new Date() },
      last_seen_at: { type: Date, default: () => new Date() },
    },

    createdAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },

    updatedAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
  },
  { versionKey: false }
);

/* =========================
   AUTO TIMESTAMP HANDLING
========================= */

AlertSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  if (this.first_seen && !this.window_start) {
    this.window_start = floorToMinute(this.first_seen);
  }

  if (this.timestamp_minute == null && this.first_seen) {
    this.timestamp_minute = floorToMinute(this.first_seen);
  }

  next();
});

/* =========================
   INDEXES (OPTIMIZED)
========================= */

// Fast alert lookup (UI)
AlertSchema.index({ user_id: 1, status: 1, severity: 1, createdAt: -1 });

// Group-based queries
AlertSchema.index({ group_key: 1, status: 1, severity: 1 });

// Time-based queries
AlertSchema.index({ group_key: 1, status: 1, createdAt: -1 });

// 🔥 CRITICAL: prevent duplicate alerts (parallel workers safe)
AlertSchema.index(
  { user_id: 1, group_key: 1, status: 1, window_start: 1 },
  {
    unique: true,
    partialFilterExpression: {
      group_key: { $exists: true },
      window_start: { $exists: true },
    },
  }
);

// Incident correlation optimization
AlertSchema.index({ actor: 1, source_ip: 1, status: 1 });

export const Alert = mongoose.model('Alert', AlertSchema);