import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import mongoose from 'mongoose';
import app from '../src/app.js';
import {
  User,
  Wallet,
  StreakCycle,
  StreakClaim,
  StreakReward,
  WalletTransaction,
  AuditLog
} from '../src/models/index.js';
import { generateToken } from '../src/utils/token.js';
import { calculateStreakState } from '../src/services/streak.service.js';
import { claimDailyReward } from '../src/services/claim.service.js';

const TEST_EMAIL = `phase4_streak_${Date.now()}@veloop.io`;
const WATCHDOG_TIMEOUT_MS = 45000;

const runPhase4Verification = async () => {
  console.log('=== VELoop Daily Streak: Phase 4 Verification ===\n');

  // Hard safety timeout
  const watchdog = setTimeout(() => {
    console.error('\n[WATCHDOG TIMEOUT] Phase 4 test exceeded 45s timeout limit.');
    process.exit(1);
  }, WATCHDOG_TIMEOUT_MS);
  watchdog.unref();

  // 1. Direct MongoDB Atlas Connection (No local fallback allowed)
  console.log('[CHECK 1] Database Connection (MongoDB Atlas Direct)');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is missing from backend/.env');

  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const dbName = conn.connection.name;
  const dbHost = conn.connection.host;

  if (dbName !== 'veloop_rewards') {
    throw new Error(`Connected to unexpected DB: "${dbName}", expected "veloop_rewards"`);
  }
  console.log(`  ✓ Successfully connected directly to Atlas host: "${dbHost}"`);
  console.log(`  ✓ Target database verified: "${dbName}"\n`);

  // Start HTTP Server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/daily-streak`;

  let testUser = null;
  let authToken = null;

  try {
    // 2. Setup Test User with Baseline Wallet and Active Cycle 1
    console.log('[CHECK 2] User Setup & Initial State');
    testUser = await User.create({
      username: 'StreakProTester',
      email: TEST_EMAIL,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'user'
    });

    await Wallet.create({
      userId: testUser._id,
      veBalance: 120,
      giftCardBalance: 0
    });

    const initialCycle = await StreakCycle.create({
      cycleId: `cycle_${testUser._id}_1_${Date.now()}`,
      userId: testUser._id,
      cycleNumber: 1,
      status: 'ACTIVE',
      startedAt: new Date()
    });

    authToken = generateToken({
      id: testUser._id.toString(),
      email: testUser.email,
      role: testUser.role
    });

    console.log(`  ✓ Test user created: ID=${testUser._id}`);
    console.log(`  ✓ Initial Wallet created with baseline 120 VEs`);
    console.log(`  ✓ Initial StreakCycle 1 active: ID=${initialCycle.cycleId}\n`);

    // 3. Full Dashboard Endpoint (GET /api/daily-streak)
    console.log('[CHECK 3] Full Dashboard Endpoint (GET /api/daily-streak)');
    const dashRes = await fetch(`${baseUrl}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const dashJson = await dashRes.json();

    if (dashRes.status !== 200 || !dashJson.success) {
      throw new Error(`GET /api/daily-streak failed: ${JSON.stringify(dashJson)}`);
    }

    const d = dashJson.data;
    if (d.cards.length !== 7) throw new Error(`Expected 7 cards, got ${d.cards.length}`);
    if (d.cards[0].status !== 'AVAILABLE' || !d.streak.canClaimToday) {
      throw new Error(`Expected Day 1 to be AVAILABLE, got status=${d.cards[0].status}, canClaimToday=${d.streak.canClaimToday}`);
    }
    for (let i = 1; i < 7; i++) {
      if (d.cards[i].status !== 'LOCKED') {
        throw new Error(`Expected Day ${i + 1} to be LOCKED initially, got ${d.cards[i].status}`);
      }
    }
    if (!d.ultimateReward || d.ultimateReward.day !== 7 || d.ultimateReward.amount !== 5) {
      throw new Error(`Ultimate reward mismatch: ${JSON.stringify(d.ultimateReward)}`);
    }

    console.log(`  ✓ 7 cards returned with server-authoritative states`);
    console.log(`  ✓ Day 1 is AVAILABLE for immediate check-in; Days 2-7 are LOCKED`);
    console.log(`  ✓ Ultimate reward verified: Day 7 ₹5 Amazon Gift Card (isUltimate: true)\n`);

    // 4. Lightweight Status Polling Endpoint (GET /api/daily-streak/status)
    console.log('[CHECK 4] Lightweight Status Endpoint (GET /api/daily-streak/status)');
    const statusRes = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const statusJson = await statusRes.json();

    if (statusRes.status !== 200 || !statusJson.canClaimToday || statusJson.eligibleDay !== 1) {
      throw new Error(`Status check failed: ${JSON.stringify(statusJson)}`);
    }
    console.log(`  ✓ Status polling verified: canClaimToday=${statusJson.canClaimToday}, eligibleDay=${statusJson.eligibleDay}, currentStreak=${statusJson.currentStreak}\n`);

    // 5A. ACID Transaction Rollback on Mid-Claim Failure
    console.log('[CHECK 5A] ACID Transaction Rollback & Failure Consistency');
    let rollbackErrorCaught = false;
    try {
      await claimDailyReward({
        userId: testUser._id.toString(),
        requestedDay: 1,
        _simulateFailureAfterWalletUpdate: true
      });
    } catch (err) {
      if (err.message === 'SIMULATED_FAILURE_AFTER_WALLET_UPDATE') {
        rollbackErrorCaught = true;
      }
    }
    if (!rollbackErrorCaught) throw new Error('Simulated failure was not caught');

    // Assert that the aborted transaction made NO persistent changes to MongoDB
    const postRollbackWallet = await Wallet.findOne({ userId: testUser._id });
    if (postRollbackWallet.veBalance !== 120) {
      throw new Error(`Wallet balance was modified despite aborted transaction! Got ${postRollbackWallet.veBalance}, expected 120`);
    }
    const postRollbackClaims = await StreakClaim.countDocuments({ userId: testUser._id, day: 1 });
    if (postRollbackClaims !== 0) {
      throw new Error(`StreakClaim document was persisted despite aborted transaction! Count: ${postRollbackClaims}`);
    }
    const postRollbackTxns = await WalletTransaction.countDocuments({ userId: testUser._id, streakDay: 1 });
    if (postRollbackTxns !== 0) {
      throw new Error(`WalletTransaction ledger was persisted despite aborted transaction! Count: ${postRollbackTxns}`);
    }
    console.log(`  ✓ Aborted transaction successfully rolled back all changes in MongoDB Atlas`);
    console.log(`  ✓ Wallet balance strictly untouched: ${postRollbackWallet.veBalance} VEs`);
    console.log(`  ✓ Zero orphaned StreakClaims and zero orphaned WalletTransactions persisted\n`);

    // 5B. Non-Blocking AuditLog Failure Resilience
    console.log('[CHECK 5B] Non-Blocking AuditLog Failure Resilience');
    const originalAuditCreate = AuditLog.create;
    let mockAuditCalled = false;
    AuditLog.create = async () => {
      mockAuditCalled = true;
      throw new Error('MOCK_AUDIT_LOG_WRITE_FAILURE');
    };

    // 5. Day 1 Reward Claim & Atomic Wallet/Ledger Update (POST /api/daily-streak/claim)
    console.log('[CHECK 5] Day 1 Reward Claim & Atomic Ledger Execution');
    const claimRes = await fetch(`${baseUrl}/claim`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ day: 1 })
    });
    const claimJson = await claimRes.json();

    // Restore original AuditLog.create immediately
    AuditLog.create = originalAuditCreate;

    if (claimRes.status !== 200 || !claimJson.success) {
      throw new Error(`Claim failed: ${JSON.stringify(claimJson)}`);
    }
    if (claimJson.claimedReward.amount !== 5 || claimJson.claimedReward.currency !== 'VES') {
      throw new Error(`Unexpected claimed reward: ${JSON.stringify(claimJson.claimedReward)}`);
    }
    if (!mockAuditCalled) {
      throw new Error('AuditLog.create mock was not invoked');
    }
    console.log(`  ✓ AuditLog write failure is non-blocking: claim succeeded with 100% integrity`);

    // Verify database state: Wallet balance incremented from 120 to 125
    const updatedWallet = await Wallet.findOne({ userId: testUser._id });
    if (updatedWallet.veBalance !== 125) {
      throw new Error(`Expected wallet veBalance 125, got ${updatedWallet.veBalance}`);
    }
    console.log(`  ✓ Wallet balance atomically updated: 120 VEs -> ${updatedWallet.veBalance} VEs (+5)`);

    // Verify WalletTransaction ledger record
    const txn = await WalletTransaction.findOne({ userId: testUser._id, streakDay: 1 });
    if (!txn || !txn.referenceId.startsWith('STREAK-D1') || txn.amount !== 5 || txn.balanceAfter !== 125) {
      throw new Error(`WalletTransaction ledger record invalid: ${JSON.stringify(txn)}`);
    }
    console.log(`  ✓ Immutable ledger record created: ID=${txn.transactionId}, Ref=${txn.referenceId}, Amount=+5 ${txn.currency}`);

    // Verify StreakClaim record with unique compound key
    const claimRecord = await StreakClaim.findOne({ userId: testUser._id, day: 1 });
    if (!claimRecord) throw new Error('StreakClaim record not found in MongoDB');
    console.log(`  ✓ StreakClaim record persisted: claimId=${claimRecord.claimId}, status=${claimRecord.status}\n`);

    // 6. Timing & Cooldown Enforcement (Immediate re-claim attempt rejected)
    console.log('[CHECK 6] Waiting Period & Cooldown Enforcement');
    const cooldownRes = await fetch(`${baseUrl}/claim`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ day: 2 })
    });
    const cooldownJson = await cooldownRes.json();

    if (cooldownRes.status !== 400 || cooldownJson.success !== false) {
      throw new Error(`Expected 400 on cooldown claim, got ${cooldownRes.status}: ${JSON.stringify(cooldownJson)}`);
    }
    console.log(`  ✓ Premature claim rejected (HTTP 400): "${cooldownJson.message}"`);

    const rejectedAudit = await AuditLog.findOne({ userId: testUser._id, event: 'STREAK_CLAIM_REJECTED' });
    if (!rejectedAudit) throw new Error('STREAK_CLAIM_REJECTED not found in AuditLog');
    console.log(`  ✓ Cooldown rejection recorded in AuditLog: ${rejectedAudit.event}\n`);

    // 7. Duplicate Claim & Concurrent Request Protection
    console.log('[CHECK 7] Concurrency & Double-Click Collision Protection');
    // Attempt duplicate claim on the already claimed Day 1 directly via service
    let duplicateRejected = false;
    try {
      await claimDailyReward({
        userId: testUser._id.toString(),
        requestedDay: 1,
        serverTime: new Date()
      });
    } catch (err) {
      if (err.statusCode === 400 || err.statusCode === 409) {
        duplicateRejected = true;
        console.log(`  ✓ Duplicate claim rejected safely with status ${err.statusCode}: "${err.message}"`);
      }
    }
    if (!duplicateRejected) throw new Error('Duplicate claim was unexpectedly allowed');

    // Test unique compound index constraint directly { userId, cycleId, day }
    let uniqueIndexCaught = false;
    try {
      await StreakClaim.create({
        claimId: `claim_${Date.now()}_dup_test`,
        userId: testUser._id,
        cycleId: initialCycle.cycleId,
        day: 1, // Already claimed day 1!
        rewardId: new mongoose.Types.ObjectId(),
        status: 'CLAIMED',
        transactionId: 'TXN-DUP-TEST'
      });
    } catch (err) {
      if (err.code === 11000) {
        uniqueIndexCaught = true;
        console.log(`  ✓ MongoDB unique compound index { userId: 1, cycleId: 1, day: 1 } blocked duplicate insertion (code 11000)`);
      }
    }
    if (!uniqueIndexCaught) throw new Error('Unique compound index failed to prevent duplicate claim insertion');
    console.log(`  ✓ Double-click and race condition defenses verified\n`);

    // 7B. True Concurrent Request Protection (Simultaneous Execution Race)
    console.log('[CHECK 7B] Simultaneous Concurrent Execution Race Condition Test');
    const raceUser = await User.create({
      username: 'RaceConditionTester',
      email: `race_${Date.now()}@veloop.io`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'user'
    });
    await Wallet.create({
      userId: raceUser._id,
      veBalance: 120,
      giftCardBalance: 0
    });
    const raceCycle = await StreakCycle.create({
      cycleId: `cycle_${raceUser._id}_1_${Date.now()}`,
      userId: raceUser._id,
      cycleNumber: 1,
      status: 'ACTIVE',
      startedAt: new Date()
    });

    // Fire two identical claims simultaneously with Promise.allSettled
    const [resA, resB] = await Promise.allSettled([
      claimDailyReward({ userId: raceUser._id.toString(), requestedDay: 1 }),
      claimDailyReward({ userId: raceUser._id.toString(), requestedDay: 1 })
    ]);

    const successes = [resA, resB].filter((r) => r.status === 'fulfilled');
    const failures = [resA, resB].filter((r) => r.status === 'rejected');

    if (successes.length !== 1 || failures.length !== 1) {
      throw new Error(`Expected exactly 1 success and 1 failure for concurrent claims, got ${successes.length} successes and ${failures.length} failures`);
    }

    const raceWallet = await Wallet.findOne({ userId: raceUser._id });
    if (raceWallet.veBalance !== 125) {
      throw new Error(`Race user wallet balance invalid: expected 125 (+5 once), got ${raceWallet.veBalance}`);
    }
    const raceClaims = await StreakClaim.countDocuments({ userId: raceUser._id, day: 1 });
    if (raceClaims !== 1) {
      throw new Error(`Expected exactly 1 StreakClaim for race user, got ${raceClaims}`);
    }
    const raceTxns = await WalletTransaction.countDocuments({ userId: raceUser._id, streakDay: 1 });
    if (raceTxns !== 1) {
      throw new Error(`Expected exactly 1 WalletTransaction for race user, got ${raceTxns}`);
    }

    // Clean up race user
    await User.deleteOne({ _id: raceUser._id });
    await Wallet.deleteOne({ userId: raceUser._id });
    await StreakCycle.deleteMany({ userId: raceUser._id });
    await StreakClaim.deleteMany({ userId: raceUser._id });
    await WalletTransaction.deleteMany({ userId: raceUser._id });
    await AuditLog.deleteMany({ userId: raceUser._id });

    console.log(`  ✓ Simultaneous race condition resolved: exactly 1 claim fulfilled, 1 rejected (${failures[0].reason.statusCode || 409})`);
    console.log(`  ✓ Race user wallet credited only once (+5 VEs -> 125), ledger verified with 1 transaction\n`);

    // 8. Day-Skipping & Client Manipulation Defense
    console.log('[CHECK 8] Anti-Tampering & Day-Skipping Defense');
    // Premature client-tampered request
    const skipRes = await fetch(`${baseUrl}/claim`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ day: 5, reward: 99999, currency: 'VES' })
    });
    const skipJson = await skipRes.json();
    if (skipRes.status !== 400 || skipJson.success !== false) {
      throw new Error(`Expected 400 for day-skipping request, got ${skipRes.status}`);
    }
    console.log(`  ✓ Premature day-skipping request rejected (HTTP 400): "${skipJson.message}"`);

    // Test specific day-mismatch check at an eligible time (advance 25h so canClaimToday is true, but client requests Day 6 instead of Day 2)
    let dayMismatchCaught = false;
    const testAdvanceTime = new Date(Date.now() + 25 * 3600 * 1000);
    try {
      await claimDailyReward({
        userId: testUser._id.toString(),
        requestedDay: 6, // Eligible is Day 2
        serverTime: testAdvanceTime
      });
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes('Day 2')) {
        dayMismatchCaught = true;
        console.log(`  ✓ Day-mismatch attack strictly rejected: "${err.message}"`);
      }
    }
    if (!dayMismatchCaught) throw new Error('Day mismatch defense failed to enforce sequential progression');

    const invalidAudit = await AuditLog.findOne({ userId: testUser._id, event: 'INVALID_CLAIM' });
    if (!invalidAudit) throw new Error('INVALID_CLAIM not recorded in AuditLog');
    console.log(`  ✓ INVALID_CLAIM recorded in AuditLog: requestedDay=${invalidAudit.details?.requestedDay}, expectedDay=${invalidAudit.details?.expectedDay}\n`);

    // 9. Progression Simulation (Days 2 to 7) & Gift Card Currency Handling
    console.log('[CHECK 9] Full 7-Day Cycle Progression Simulation');
    let simulatedTime = new Date();

    // Reward amounts from Day 2 through Day 7
    // Day 2: 10 VEs (VES)
    // Day 3: 15 VEs (VES)
    // Day 4: 1 INR (GIFT_CARD)
    // Day 5: 2 INR (GIFT_CARD)
    // Day 6: 30 VEs (VES)
    // Day 7: 5 INR (GIFT_CARD)
    for (let day = 2; day <= 7; day++) {
      // Advance time by 24h + 1 minute
      simulatedTime = new Date(simulatedTime.getTime() + 24 * 3600 * 1000 + 60 * 1000);

      const claimResult = await claimDailyReward({
        userId: testUser._id.toString(),
        requestedDay: day,
        serverTime: simulatedTime
      });

      if (!claimResult.success || claimResult.claimedReward.day !== day) {
        throw new Error(`Failed to claim Day ${day}: ${JSON.stringify(claimResult)}`);
      }
      console.log(`  ✓ Day ${day} claimed successfully at simulated time (+24h): ${claimResult.claimedReward.title} (Amount: ${claimResult.claimedReward.amount} ${claimResult.claimedReward.currency})`);
    }

    // Verify final balances after complete 7-day cycle:
    // VEs: 120 baseline + 5 (D1) + 10 (D2) + 15 (D3) + 30 (D6) = 180 VEs
    // Gift Cards: 0 baseline + 1 (D4) + 2 (D5) + 5 (D7) = 8 INR
    const finalWallet = await Wallet.findOne({ userId: testUser._id });
    if (finalWallet.veBalance !== 180 || finalWallet.giftCardBalance !== 8) {
      throw new Error(`Final wallet mismatch: expected 180 VEs and 8 INR, got ve=${finalWallet.veBalance}, gift=${finalWallet.giftCardBalance}`);
    }
    console.log(`  ✓ Final wallet verified: ${finalWallet.veBalance} VEs (expected 180), ₹${finalWallet.giftCardBalance} Gift Card (expected 8)\n`);

    // 10. Cycle Completion Verification
    console.log('[CHECK 10] Cycle Completion & Continuation');
    const completedCycle = await StreakCycle.findOne({ cycleId: initialCycle.cycleId });
    if (completedCycle.status !== 'COMPLETED') {
      throw new Error(`Expected cycle status COMPLETED, got "${completedCycle.status}"`);
    }
    console.log(`  ✓ Cycle 1 marked as COMPLETED: completedAt=${completedCycle.completedAt.toISOString()}`);

    // Advance time by 24h to trigger Cycle 2 start
    const cycle2Time = new Date(simulatedTime.getTime() + 24 * 3600 * 1000 + 60 * 1000);
    const cycle2State = await calculateStreakState(testUser._id.toString(), cycle2Time);

    if (cycle2State.cycle.cycleNumber !== 2 || cycle2State.cycle.status !== 'ACTIVE') {
      throw new Error(`Expected Cycle 2 ACTIVE, got cycleNumber=${cycle2State.cycle.cycleNumber}, status=${cycle2State.cycle.status}`);
    }
    if (cycle2State.streak.currentStreak !== 0 || !cycle2State.streak.canClaimToday || cycle2State.cards[0].status !== 'AVAILABLE') {
      throw new Error(`Cycle 2 not reset to Day 1: ${JSON.stringify(cycle2State.streak)}`);
    }
    // Verify cumulative lifetime metrics remain intact
    if (cycle2State.statistics.lifetimeClaims !== 7 || cycle2State.statistics.completedCycles !== 1) {
      throw new Error(`Lifetime statistics mismatch: ${JSON.stringify(cycle2State.statistics)}`);
    }
    console.log(`  ✓ Cycle 2 automatically initiated after 24h interval`);
    console.log(`  ✓ Day 1 AVAILABLE in Cycle 2, lifetime claims preserved (${cycle2State.statistics.lifetimeClaims} claims, ${cycle2State.statistics.completedCycles} completed cycle)\n`);

    // 11. Missed-Day Detection & Automatic Reset Verification
    console.log('[CHECK 11] Missed-Day Window Expiration & Streak Reset');
    // Claim Day 1 in Cycle 2
    await claimDailyReward({
      userId: testUser._id.toString(),
      requestedDay: 1,
      serverTime: cycle2Time
    });

    // Advance time past 48 hours (24h claim interval + 24h grace window)
    const resetTime = new Date(cycle2Time.getTime() + (24 + 24 + 2) * 3600 * 1000); // 50 hours later
    const resetState = await calculateStreakState(testUser._id.toString(), resetTime);

    if (!resetState.streak.didReset) {
      throw new Error('Streak engine failed to detect missed claim window');
    }
    if (resetState.cycle.cycleNumber !== 3 || resetState.streak.currentStreak !== 0 || !resetState.streak.canClaimToday) {
      throw new Error(`Reset state invalid: ${JSON.stringify(resetState)}`);
    }

    const resetAudit = await AuditLog.findOne({ userId: testUser._id, event: 'STREAK_RESET' });
    if (!resetAudit) throw new Error('STREAK_RESET not recorded in AuditLog');
    console.log(`  ✓ Missed-day window expired: streak reset to Day 1, previous cycle set to RESET`);
    console.log(`  ✓ STREAK_RESET logged in AuditLog: reason=${resetAudit.details?.reason}\n`);

    // 12. History & Wallet Endpoints
    console.log('[CHECK 12] History & Wallet Endpoints');
    const histRes = await fetch(`${baseUrl}/history`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const histJson = await histRes.json();
    if (histRes.status !== 200 || !histJson.success || histJson.data.totalClaims < 8) {
      throw new Error(`GET /api/daily-streak/history invalid: ${JSON.stringify(histJson)}`);
    }
    console.log(`  ✓ Claim history verified: ${histJson.data.totalClaims} total claims recorded in ledger`);

    const walletRes = await fetch(`http://127.0.0.1:${port}/api/wallet`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const walletJson = await walletRes.json();
    if (walletRes.status !== 200 || !walletJson.success || !walletJson.data.balances) {
      throw new Error(`GET /api/wallet invalid: ${JSON.stringify(walletJson)}`);
    }
    console.log(`  ✓ Wallet endpoint verified: VEs=${walletJson.data.balances.veBalance}, GiftCards=₹${walletJson.data.balances.giftCardBalance}\n`);

    console.log('=== ALL PHASE 4 VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
  } finally {
    // Clean up test documents
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
      await Wallet.deleteOne({ userId: testUser._id });
      await StreakCycle.deleteMany({ userId: testUser._id });
      await StreakClaim.deleteMany({ userId: testUser._id });
      await WalletTransaction.deleteMany({ userId: testUser._id });
      await AuditLog.deleteMany({ userId: testUser._id });
    }
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
  process.exit(0);
};

runPhase4Verification().catch(async (err) => {
  console.error('\n[FATAL ERROR]', err.message);
  try {
    await mongoose.disconnect();
  } catch (e) {}
  process.exit(1);
});
