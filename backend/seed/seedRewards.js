import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore in restricted environments
}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();
import mongoose from 'mongoose';
import { StreakReward, StreakConfig } from '../src/models/index.js';

const DEFAULT_REWARDS = [
  {
    day: 1,
    rewardType: 'VES',
    currency: 'VES',
    amount: 5,
    title: '+5',
    subtitle: '5 VEs',
    assetType: 'coin',
    badgeText: null,
    isUltimate: false,
    active: true
  },
  {
    day: 2,
    rewardType: 'VES',
    currency: 'VES',
    amount: 10,
    title: '+10',
    subtitle: '10 VEs',
    assetType: 'coin',
    badgeText: 'Today',
    isUltimate: false,
    active: true
  },
  {
    day: 3,
    rewardType: 'VES',
    currency: 'VES',
    amount: 15,
    title: '+15',
    subtitle: '15 VEs',
    assetType: 'coin',
    badgeText: null,
    isUltimate: false,
    active: true
  },
  {
    day: 4,
    rewardType: 'GIFT_CARD',
    currency: 'INR',
    amount: 1,
    title: '₹1',
    subtitle: 'Amazon Gift Card',
    assetType: 'gift-card',
    badgeText: null,
    isUltimate: false,
    active: true
  },
  {
    day: 5,
    rewardType: 'GIFT_CARD',
    currency: 'INR',
    amount: 2,
    title: '₹2',
    subtitle: 'Amazon Gift Card',
    assetType: 'gift-card',
    badgeText: 'Gift Card',
    isUltimate: false,
    active: true
  },
  {
    day: 6,
    rewardType: 'VES',
    currency: 'VES',
    amount: 30,
    title: '+30',
    subtitle: '30 VEs',
    assetType: 'coin',
    badgeText: 'Coin',
    isUltimate: false,
    active: true
  },
  {
    day: 7,
    rewardType: 'GIFT_CARD',
    currency: 'INR',
    amount: 5,
    title: '₹5',
    subtitle: 'Amazon Gift Card',
    assetType: 'crown',
    badgeText: 'VIP',
    isUltimate: true,
    active: true
  }
];

export const seedRewards = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is missing from environment variables');
  }

  const conn = await mongoose.connect(uri);
  const dbName = conn.connection.name;

  if (dbName !== 'veloop_rewards') {
    throw new Error(`Safety check failed: Connected to unexpected database "${dbName}". Must target "veloop_rewards".`);
  }

  console.log(`[INFO] Connected to database: ${dbName} for seeding`);

  const now = new Date();

  // 1. Seed Streak Configuration (Idempotent upsert with timestamps: false)
  const config = await StreakConfig.findOneAndUpdate(
    { configKey: 'DEFAULT_7_DAY' },
    {
      $set: {
        cycleLengthDays: 7,
        claimIntervalHours: 24,
        gracePeriodHours: 24,
        isActive: true
      },
      $setOnInsert: {
        createdAt: now,
        updatedAt: now
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, timestamps: false }
  );
  console.log(`[SEED] StreakConfig ready: cycleLength=${config.cycleLengthDays} days, claimInterval=${config.claimIntervalHours}h`);

  // 2. Seed 7 Daily Rewards (Idempotent upserts with timestamps: false to preserve untouched documents)
  const rewardOperations = DEFAULT_REWARDS.map(reward => ({
    updateOne: {
      filter: { day: reward.day },
      update: {
        $set: reward,
        $setOnInsert: {
          createdAt: now,
          updatedAt: now
        }
      },
      upsert: true
    }
  }));

  const result = await StreakReward.bulkWrite(rewardOperations, { timestamps: false });
  console.log(`[SEED] StreakRewards upserted: matched=${result.matchedCount}, upserted=${result.upsertedCount}, modified=${result.modifiedCount}`);

  const allRewards = await StreakReward.find().sort({ day: 1 });
  console.log(`[VERIFY] Total active rewards in database: ${allRewards.length}`);
  allRewards.forEach(r => {
    console.log(`  Day ${r.day}: ${r.title} ${r.subtitle} (Type: ${r.rewardType}, Asset: ${r.assetType}, Ultimate: ${r.isUltimate})`);
  });

  return { allRewards, result, config };
};

// Execute if run directly from command line
if (process.argv[1]?.endsWith('seedRewards.js')) {
  seedRewards()
    .then(async () => {
      console.log('[SUCCESS] Reward and configuration seeding completed successfully.');
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(`[ERROR] Seeding failed: ${err.message}`);
      await mongoose.disconnect();
      process.exit(1);
    });
}
