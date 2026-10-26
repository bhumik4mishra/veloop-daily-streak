import mongoose from 'mongoose';

const streakRewardSchema = new mongoose.Schema({
  day: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 7
  },
  rewardType: {
    type: String,
    required: true,
    enum: ['VES', 'GIFT_CARD']
  },
  currency: {
    type: String,
    required: true,
    enum: ['VES', 'INR']
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  assetType: {
    type: String,
    required: true,
    enum: ['coin', 'gift-card', 'crown']
  },
  badgeText: {
    type: String,
    default: null // e.g. 'Today', 'Gift Card', 'Coin', 'VIP'
  },
  isUltimate: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

export const StreakReward = mongoose.model('StreakReward', streakRewardSchema);
