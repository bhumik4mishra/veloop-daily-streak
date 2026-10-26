import mongoose from 'mongoose';

const streakClaimSchema = new mongoose.Schema({
  claimId: {
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
  cycleId: {
    type: String,
    required: true,
    index: true
  },
  day: {
    type: Number,
    required: true,
    min: 1,
    max: 7
  },
  rewardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StreakReward',
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['CLAIMED'],
    default: 'CLAIMED'
  },
  claimedAt: {
    type: Date,
    default: Date.now
  },
  transactionId: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// MANDATORY unique compound constraint from PDF Sec. 62:
// Guarantees DB-level impossibility of duplicate claims in the same cycle
streakClaimSchema.index({ userId: 1, cycleId: 1, day: 1 }, { unique: true });

export const StreakClaim = mongoose.model('StreakClaim', streakClaimSchema);
