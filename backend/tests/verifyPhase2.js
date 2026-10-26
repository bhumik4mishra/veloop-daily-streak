import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();
import mongoose from 'mongoose';
import {
  User,
  Wallet,
  StreakConfig,
  StreakReward,
  StreakCycle,
  StreakClaim,
  WalletTransaction,
  AuditLog
} from '../src/models/index.js';
import { seedRewards } from '../seed/seedRewards.js';

const runVerification = async () => {
  console.log('=== VELoop Daily Streak: Phase 2 Verification ===\n');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is missing');

  const conn = await mongoose.connect(uri);
  const dbName = conn.connection.name;

  console.log(`[CHECK 1] Database Connection`);
  if (dbName !== 'veloop_rewards') {
    throw new Error(`Connected to ${dbName}, expected "veloop_rewards"`);
  }
  console.log(`  ✓ Successfully connected to MongoDB Atlas database: "${dbName}"\n`);

  console.log(`[CHECK 2] Run Idempotent Seed`);
  const initialSeed = await seedRewards();
  console.log(`  ✓ Initial seed passed (matched=${initialSeed.result?.matchedCount}, upserted=${initialSeed.result?.upsertedCount}, modified=${initialSeed.result?.modifiedCount})\n`);

  console.log(`[CHECK 3] Seed Idempotency Check (Run 2)`);
  const secondSeed = await seedRewards();
  const countAfterSecondSeed = await StreakReward.countDocuments();
  if (countAfterSecondSeed !== 7) {
    throw new Error(`Expected exactly 7 rewards, found ${countAfterSecondSeed}`);
  }
  if (secondSeed.result && secondSeed.result.modifiedCount !== 0) {
    throw new Error(`Idempotency check failed: expected 0 modified documents on re-seed, but got ${secondSeed.result.modifiedCount}`);
  }
  console.log(`  ✓ Idempotency verified: re-seeding leaves database completely unchanged (matched=${secondSeed.result?.matchedCount}, modified=${secondSeed.result?.modifiedCount}, total=${countAfterSecondSeed})\n`);

  console.log(`[CHECK 4] Verify All 7 Rewards Match Assignment PDF Exactly`);
  const expectedRewards = [
    { day: 1, type: 'VES', curr: 'VES', amt: 5, ult: false },
    { day: 2, type: 'VES', curr: 'VES', amt: 10, ult: false },
    { day: 3, type: 'VES', curr: 'VES', amt: 15, ult: false },
    { day: 4, type: 'GIFT_CARD', curr: 'INR', amt: 1, ult: false },
    { day: 5, type: 'GIFT_CARD', curr: 'INR', amt: 2, ult: false },
    { day: 6, type: 'VES', curr: 'VES', amt: 30, ult: false },
    { day: 7, type: 'GIFT_CARD', curr: 'INR', amt: 5, ult: true }
  ];

  for (const exp of expectedRewards) {
    const r = await StreakReward.findOne({ day: exp.day });
    if (!r) throw new Error(`Day ${exp.day} reward missing`);
    if (r.rewardType !== exp.type || r.currency !== exp.curr || r.amount !== exp.amt || r.isUltimate !== exp.ult) {
      throw new Error(`Day ${exp.day} mismatch: got type=${r.rewardType}, curr=${r.currency}, amt=${r.amount}, ult=${r.isUltimate}`);
    }
    console.log(`  ✓ Day ${exp.day}: ${r.title} ${r.subtitle} (Type: ${r.rewardType}, Curr: ${r.currency}, Amt: ${r.amount}, Ultimate: ${r.isUltimate})`);
  }
  console.log('');

  console.log(`[CHECK 5] Verify StreakConfig`);
  const config = await StreakConfig.findOne({ configKey: 'DEFAULT_7_DAY' });
  if (!config) throw new Error('StreakConfig DEFAULT_7_DAY not found');
  if (config.cycleLengthDays !== 7 || config.claimIntervalHours !== 24 || config.gracePeriodHours !== 24) {
    throw new Error(`Unexpected config values: ${JSON.stringify(config)}`);
  }
  console.log(`  ✓ StreakConfig: cycleLength=${config.cycleLengthDays} days, claimInterval=${config.claimIntervalHours}h, gracePeriod=${config.gracePeriodHours}h\n`);

  console.log(`[CHECK 6] Verify Database Indexes`);
  // Ensure indexes are built
  await Promise.all([
    StreakClaim.init(),
    User.init(),
    Wallet.init(),
    StreakCycle.init(),
    StreakReward.init(),
    WalletTransaction.init(),
    AuditLog.init()
  ]);

  const claimIndexes = await StreakClaim.collection.indexes();
  const hasUniqueCompoundClaim = claimIndexes.some(idx => 
    idx.unique === true && 
    idx.key.userId === 1 && 
    idx.key.cycleId === 1 && 
    idx.key.day === 1
  );
  if (!hasUniqueCompoundClaim) {
    throw new Error('StreakClaim unique compound index { userId: 1, cycleId: 1, day: 1 } is missing!');
  }
  console.log(`  ✓ StreakClaim unique compound index verified: { userId: 1, cycleId: 1, day: 1 }`);

  const userIndexes = await User.collection.indexes();
  const hasUserEmailUnique = userIndexes.some(idx => idx.unique === true && idx.key.email === 1);
  if (!hasUserEmailUnique) {
    throw new Error('User unique email index missing');
  }
  console.log(`  ✓ User unique email index verified: { email: 1 }`);

  const walletIndexes = await Wallet.collection.indexes();
  const hasWalletUserUnique = walletIndexes.some(idx => idx.unique === true && idx.key.userId === 1);
  if (!hasWalletUserUnique) {
    throw new Error('Wallet unique userId index missing');
  }
  console.log(`  ✓ Wallet unique userId index verified: { userId: 1 }`);

  const cycleIndexes = await StreakCycle.collection.indexes();
  const hasCycleStatusIndex = cycleIndexes.some(idx => idx.key.userId === 1 && idx.key.status === 1);
  if (!hasCycleStatusIndex) {
    throw new Error('StreakCycle compound index missing');
  }
  console.log(`  ✓ StreakCycle compound index verified: { userId: 1, status: 1 }\n`);

  console.log(`[CHECK 7] Schema Validation & Constraints`);
  // Test invalid email
  const invalidUser = new User({ username: 'abc', email: 'not-an-email', passwordHash: 'hash' });
  let userValidationPassed = false;
  try {
    await invalidUser.validate();
  } catch (err) {
    userValidationPassed = true;
    console.log(`  ✓ User schema rejected invalid email: "${err.errors.email?.message}"`);
  }
  if (!userValidationPassed) throw new Error('User validation allowed invalid email');

  // Test negative wallet balance
  const invalidWallet = new Wallet({ userId: new mongoose.Types.ObjectId(), veBalance: -50 });
  let walletValidationPassed = false;
  try {
    await invalidWallet.validate();
  } catch (err) {
    walletValidationPassed = true;
    console.log(`  ✓ Wallet schema rejected negative balance: "${err.errors.veBalance?.message}"`);
  }
  if (!walletValidationPassed) throw new Error('Wallet validation allowed negative balance');

  // Test invalid reward day (e.g. Day 8)
  const invalidReward = new StreakReward({
    day: 8,
    rewardType: 'VES',
    currency: 'VES',
    amount: 10,
    title: 'Invalid',
    assetType: 'coin'
  });
  let rewardValidationPassed = false;
  try {
    await invalidReward.validate();
  } catch (err) {
    rewardValidationPassed = true;
    console.log(`  ✓ StreakReward schema rejected out-of-range day 8: "${err.errors.day?.message}"`);
  }
  if (!rewardValidationPassed) throw new Error('Reward validation allowed day 8');

  console.log('\n=== ALL PHASE 2 VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
  await mongoose.disconnect();
  process.exit(0);
};

runVerification().catch(async (err) => {
  console.error('\n[FATAL ERROR]', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
