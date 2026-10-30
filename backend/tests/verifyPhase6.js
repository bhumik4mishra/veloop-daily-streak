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
import { User, Wallet, StreakCycle, StreakClaim, WalletTransaction, StreakReward } from '../src/models/index.js';

const TEST_TIMESTAMP = Date.now();
const TEST_EMAIL = `phase6_tester_${TEST_TIMESTAMP}@veloop.io`;
const TEST_USERNAME = `Phase6User_${TEST_TIMESTAMP}`;
const TEST_PASSWORD = 'Password123!';

const makeRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
};

const runPhase6Verification = async () => {
  console.log('=== VELoop Daily Streak: Phase 6 Integration Verification ===\n');

  // Hard safety timeout
  const watchdog = setTimeout(() => {
    console.error('\n[WATCHDOG TIMEOUT] Phase 6 verification exceeded 40s timeout.');
    process.exit(1);
  }, 40000);
  watchdog.unref();

  // 1. Database Connection
  console.log('[CHECK 1] Database Connection to MongoDB Atlas');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is missing from backend/.env');

  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`  ✓ Successfully connected to MongoDB Atlas: "${conn.connection.name}"\n`);

  // Start HTTP Server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  let authToken = null;
  let testUserId = null;

  try {
    // 2. Integration Test: User Registration API
    console.log('[CHECK 2] User Registration (POST /api/auth/register)');
    const regRes = await makeRequest(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      }
    );

    if (regRes.status !== 201 || !regRes.data?.success || !regRes.data?.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes)}`);
    }
    authToken = regRes.data.token;
    testUserId = regRes.data.user.id;
    console.log(`  ✓ Registration successful (status=201): User ID=${testUserId}`);
    console.log(`  ✓ Initial Wallet credited: ${regRes.data.user.wallet.veBalance} VEs\n`);

    // 3. Integration Test: Session Validation (GET /api/auth/me)
    console.log('[CHECK 3] Session Profile Validation (GET /api/auth/me)');
    const meRes = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (meRes.status !== 200 || !meRes.data?.success || meRes.data.user?.email !== TEST_EMAIL) {
      throw new Error(`Profile check failed: ${JSON.stringify(meRes)}`);
    }
    console.log(`  ✓ Session verified for user: ${meRes.data.user.username} (${meRes.data.user.email})\n`);

    // 4. Integration Test: Server-Authoritative Streak Dashboard (GET /api/daily-streak)
    console.log('[CHECK 4] Live Dashboard Sync (GET /api/daily-streak)');
    const dashRes = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/daily-streak',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (dashRes.status !== 200 || !dashRes.data?.success || !dashRes.data?.data) {
      throw new Error(`Dashboard fetch failed: ${JSON.stringify(dashRes)}`);
    }
    const dash = dashRes.data.data;
    if (dash.streak.currentStreak !== 0 || dash.streak.eligibleDay !== 1 || !dash.streak.canClaimToday) {
      throw new Error(`Unexpected initial streak state: ${JSON.stringify(dash.streak)}`);
    }
    if (!Array.isArray(dash.cards) || dash.cards.length !== 7) {
      throw new Error(`Expected 7 cards array from server, got ${dash.cards?.length}`);
    }
    const day1Card = dash.cards[0];
    if (day1Card.status !== 'AVAILABLE' || day1Card.amount !== 5 || day1Card.rewardType !== 'VES') {
      throw new Error(`Day 1 card should be AVAILABLE (+5 VEs), got: ${JSON.stringify(day1Card)}`);
    }
    console.log(`  ✓ Authoritative Cycle: #${dash.cycle.cycleNumber} (ID: ${dash.cycle.cycleId})`);
    console.log(`  ✓ Initial Streak: ${dash.streak.currentStreak} days, Day 1 status: "${day1Card.status}"`);
    console.log(`  ✓ Live Wallet: ${dash.wallet.veBalance} VEs, ₹${dash.wallet.giftCardBalance}\n`);

    // 5. Integration Test: Lightweight Status Polling (GET /api/daily-streak/status)
    console.log('[CHECK 5] Lightweight Status Polling (GET /api/daily-streak/status)');
    const statusRes = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/daily-streak/status',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (statusRes.status !== 200 || !statusRes.data?.success || !statusRes.data.canClaimToday) {
      throw new Error(`Status polling failed: ${JSON.stringify(statusRes)}`);
    }
    console.log(`  ✓ Polling endpoint returns canClaimToday=true, eligibleDay=1\n`);

    // 6. Integration Test: Execute Real Daily Claim (POST /api/daily-streak/claim)
    console.log('[CHECK 6] Daily Claim Execution (POST /api/daily-streak/claim)');
    const claimRes = await makeRequest(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/daily-streak/claim',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      },
      { day: 1 }
    );

    if (claimRes.status !== 200 || !claimRes.data?.success) {
      throw new Error(`Claim request failed: ${JSON.stringify(claimRes)}`);
    }
    const claimData = claimRes.data;
    if (claimData.claimedReward?.amount !== 5 || claimData.claimedReward?.currency !== 'VES') {
      throw new Error(`Unexpected claimed reward: ${JSON.stringify(claimData.claimedReward)}`);
    }
    if (claimData.transaction?.balanceAfter !== 125) {
      throw new Error(`Expected wallet balanceAfter 125 VEs, got ${claimData.transaction?.balanceAfter}`);
    }
    if (claimData.streakState?.streak?.currentStreak !== 1) {
      throw new Error(`Expected streak 1, got ${claimData.streakState?.streak?.currentStreak}`);
    }
    console.log(`  ✓ Claim successful: "${claimData.message}"`);
    console.log(`  ✓ Transaction ID: ${claimData.transaction.transactionId}`);
    console.log(`  ✓ Wallet Balance updated: 120 -> ${claimData.transaction.balanceAfter} VEs`);
    console.log(`  ✓ Current Streak updated: 0 -> ${claimData.streakState.streak.currentStreak}\n`);

    // 7. Integration Test: Waiting Period / Cooldown Enforcement (Immediate Re-Claim Rejection)
    console.log('[CHECK 7] Waiting Period Re-Claim Protection');
    const rejClaimRes = await makeRequest(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/daily-streak/claim',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      },
      { day: 2 }
    );

    if (rejClaimRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request for cooldown rejection, got: ${rejClaimRes.status}`);
    }
    console.log(`  ✓ Immediate re-claim rejected by server (status=400): "${rejClaimRes.data.message}"\n`);

    // 8. Integration Test: Wallet Balance & Ledger Endpoint (GET /api/daily-streak/wallet)
    console.log('[CHECK 8] Live Wallet & Ledger Verification (GET /api/daily-streak/wallet)');
    const walletRes = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/daily-streak/wallet',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (walletRes.status !== 200 || !walletRes.data?.success) {
      throw new Error(`Wallet fetch failed: ${JSON.stringify(walletRes)}`);
    }
    const walletData = walletRes.data.data;
    const balanceObj = walletData.balances || walletData.wallet;
    if (balanceObj.veBalance !== 125) {
      throw new Error(`Expected wallet balance 125, got ${balanceObj.veBalance}`);
    }
    if (!walletData.recentTransactions || walletData.recentTransactions.length === 0) {
      throw new Error('Expected recent transactions in wallet response');
    }
    console.log(`  ✓ Wallet confirmed: ${balanceObj.veBalance} VEs, ₹${balanceObj.giftCardBalance}`);
    console.log(`  ✓ Ledger entries recorded: ${walletData.recentTransactions.length} transaction(s)\n`);

    // 9. Integration Test: History Endpoint (GET /api/daily-streak/history)
    console.log('[CHECK 9] History & Cycle Ledger (GET /api/daily-streak/history)');
    const histRes = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/daily-streak/history',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (histRes.status !== 200 || !histRes.data?.success) {
      throw new Error(`History fetch failed: ${JSON.stringify(histRes)}`);
    }
    console.log(`  ✓ History claims found: ${histRes.data.data.totalClaims}`);
    console.log(`  ✓ Active Cycle count: ${histRes.data.data.cycles?.length}\n`);

    // 10. Integration Test: Unauthorized Access Defense (401 without Token)
    console.log('[CHECK 10] Unauthorized Route Protection');
    const unauthRes = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/daily-streak',
      method: 'GET'
    });

    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for request without token, got: ${unauthRes.status}`);
    }
    console.log(`  ✓ Protected route strictly rejected unauthorized access with 401\n`);

    console.log('=== ALL PHASE 6 INTEGRATION CHECKS PASSED SUCCESSFULLY ===');
  } finally {
    // Cleanup test user and transaction documents
    try {
      if (testUserId) {
        await User.deleteOne({ _id: testUserId });
        await Wallet.deleteOne({ userId: testUserId });
        await StreakCycle.deleteMany({ userId: testUserId });
        await StreakClaim.deleteMany({ userId: testUserId });
        await WalletTransaction.deleteMany({ userId: testUserId });
      }
    } catch {}

    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close();
    clearTimeout(watchdog);
  }
};

runPhase6Verification().catch((err) => {
  console.error('\n[PHASE 6 VERIFICATION FAILED]', err);
  process.exit(1);
});
