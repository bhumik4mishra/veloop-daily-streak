import mongoose from 'mongoose';

const streakConfigSchema = new mongoose.Schema({
  configKey: {
    type: String,
    required: true,
    unique: true,
    default: 'DEFAULT_7_DAY'
  },
  cycleLengthDays: {
    type: Number,
    required: true,
    default: 7
  },
  claimIntervalHours: {
    type: Number,
    required: true,
    default: 24, // Configurable claim wait period (prevents hardcoding 24h)
    min: 0.01
  },
  gracePeriodHours: {
    type: Number,
    required: true,
    default: 24, // Window after claimIntervalHours before a streak resets
    min: 0.01
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export const StreakConfig = mongoose.model('StreakConfig', streakConfigSchema);
