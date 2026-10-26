import mongoose from 'mongoose';

const streakCycleSchema = new mongoose.Schema({
  cycleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  cycleNumber: {
    type: Number,
    required: true,
    default: 1
  },
  status: {
    type: String,
    required: true,
    enum: ['ACTIVE', 'COMPLETED', 'RESET'],
    default: 'ACTIVE'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for active cycle lookup per user
streakCycleSchema.index({ userId: 1, status: 1 });

export const StreakCycle = mongoose.model('StreakCycle', streakCycleSchema);
