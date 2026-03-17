import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'analyst', 'viewer'], default: 'analyst' },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);

export const User = mongoose.model('User', UserSchema);
