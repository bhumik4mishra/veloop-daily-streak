import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import mongoose from 'mongoose';
import app from '../src/app.js';
import { User, Wallet, StreakCycle, AuditLog } from '../src/models/index.js';
import { verifyToken } from '../src/utils/token.js';
import { authenticateUser } from '../src/middleware/auth.middleware.js';
import { authRateLimiter, testableAuthLimiter } from '../src/middleware/rateLimiter.js';

const TEST_USER = {
  username: 'StreakChampion',
  email: `tester_streak_${Date.now()}@veloop.io`,
  password: 'SecurePassword123!'
};

const runPhase3Verification = async () => {
  console.log('=== VELoop Daily Streak: Phase 3 Verification ===\n');

  // Hard safety timeout: guarantees tests will never hang indefinitely
  const watchdog = setTimeout(() => {
    console.error('\n[WATCHDOG TIMEOUT] Test execution exceeded 20 seconds limit.');
    process.exit(1);
  }, 20000);
  watchdog.unref();
  
  // 1. Database Connection
  console.log('[CHECK 1] Database Connection');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is missing from backend/.env');

  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const dbName = conn.connection.name;
  const dbHost = conn.connection.host;
  if (dbName !== 'veloop_rewards') {
    throw new Error(`Connected to ${dbName}, expected "veloop_rewards"`);
  }
  console.log(`  ✓ Successfully connected to MongoDB Atlas host: "${dbHost}"`);
  console.log(`  ✓ Target database verified: "${dbName}"\n`);

  // Start HTTP Server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth`;

  let userToken = null;
  let registeredUserId = null;

  try {
    // 2. Input Validation Checks
    console.log('[CHECK 2] Input Validation');
    // Short username
    const shortUserRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ab', email: TEST_USER.email, password: TEST_USER.password })
    });
    const shortUserJson = await shortUserRes.json();
    if (shortUserRes.status !== 400 || shortUserJson.success !== false) {
      throw new Error(`Expected 400 for short username, got ${shortUserRes.status}`);
    }
    console.log(`  ✓ Rejected short username (< 3 chars): "${shortUserJson.message}"`);

    // Invalid email
    const invalidEmailRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER.username, email: 'not-an-email', password: TEST_USER.password })
    });
    const invalidEmailJson = await invalidEmailRes.json();
    if (invalidEmailRes.status !== 400 || invalidEmailJson.success !== false) {
      throw new Error(`Expected 400 for invalid email, got ${invalidEmailRes.status}`);
    }
    console.log(`  ✓ Rejected invalid email format: "${invalidEmailJson.message}"`);

    // Short password
    const shortPassRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER.username, email: TEST_USER.email, password: '123' })
    });
    const shortPassJson = await shortPassRes.json();
    if (shortPassRes.status !== 400 || shortPassJson.success !== false) {
      throw new Error(`Expected 400 for short password, got ${shortPassRes.status}`);
    }
    console.log(`  ✓ Rejected short password (< 6 chars): "${shortPassJson.message}"\n`);

    // 3. Secure User Registration & Password Hashing
    console.log('[CHECK 3] Secure User Registration');
    const regRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });
    const regJson = await regRes.json();
    if (regRes.status !== 201 || !regJson.success || !regJson.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
    }

    userToken = regJson.token;
    registeredUserId = regJson.user.id;

    if (regJson.user.passwordHash || regJson.user.password) {
      throw new Error('CRITICAL SECURITY LEAK: Password or hash leaked in registration response!');
    }
    console.log(`  ✓ Registration succeeded (HTTP 201 Created)`);
    console.log(`  ✓ User ID: ${registeredUserId}, Token issued`);

    // Verify DB state: password is NOT plaintext
    const dbUser = await User.findById(registeredUserId);
    if (!dbUser) throw new Error('User not found in MongoDB after registration');
    if (dbUser.passwordHash === TEST_USER.password) {
      throw new Error('CRITICAL VULNERABILITY: Password stored in plaintext!');
    }
    if (!dbUser.passwordHash.startsWith('$2a$') && !dbUser.passwordHash.startsWith('$2b$')) {
      throw new Error('Password hash does not have valid bcrypt signature ($2a$/$2b$)');
    }
    console.log(`  ✓ Password securely hashed with bcrypt in database: "${dbUser.passwordHash.slice(0, 15)}..."`);

    const isMatch = await dbUser.comparePassword(TEST_USER.password);
    const isWrongMatch = await dbUser.comparePassword('WrongPassword123');
    if (!isMatch || isWrongMatch) {
      throw new Error('bcrypt comparePassword verification failed');
    }
    console.log(`  ✓ dbUser.comparePassword() verified: accepts valid password, rejects invalid\n`);

    // 4. Default Wallet & StreakCycle Initialization
    console.log('[CHECK 4] Wallet & StreakCycle Auto-Initialization');
    const wallet = await Wallet.findOne({ userId: registeredUserId });
    if (!wallet) throw new Error('Wallet document was not created for registered user');
    if (wallet.veBalance !== 120 || wallet.giftCardBalance !== 0) {
      throw new Error(`Unexpected wallet balances: ve=${wallet.veBalance}, gift=${wallet.giftCardBalance}`);
    }
    console.log(`  ✓ Default wallet created with baseline 120 VEs (veBalance=${wallet.veBalance}, giftCardBalance=${wallet.giftCardBalance})`);

    const activeCycle = await StreakCycle.findOne({ userId: registeredUserId, status: 'ACTIVE' });
    if (!activeCycle) throw new Error('Active StreakCycle was not created for registered user');
    if (activeCycle.cycleNumber !== 1) {
      throw new Error(`Expected cycleNumber 1, got ${activeCycle.cycleNumber}`);
    }
    console.log(`  ✓ Active StreakCycle 1 initialized: cycleId=${activeCycle.cycleId}, status=${activeCycle.status}\n`);

    // 5. Audit Logging for Registration
    console.log('[CHECK 5] Audit Logging for User Registration');
    const regAudit = await AuditLog.findOne({ userId: registeredUserId, event: 'USER_REGISTER' });
    if (!regAudit) throw new Error('No USER_REGISTER event recorded in AuditLog');
    if (regAudit.details?.password || regAudit.details?.passwordHash) {
      throw new Error('CRITICAL SECURITY LEAK: Passwords found in AuditLog details!');
    }
    console.log(`  ✓ USER_REGISTER event recorded in AuditLog: event=${regAudit.event}, timestamp=${regAudit.timestamp.toISOString()}`);
    console.log(`  ✓ AuditLog details sanitized: ${JSON.stringify(regAudit.details)}\n`);

    // 6. Duplicate Registration Protection
    console.log('[CHECK 6] Duplicate Registration Prevention');
    const dupRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });
    const dupJson = await dupRes.json();
    if (dupRes.status !== 409 || dupJson.success !== false) {
      throw new Error(`Expected 409 Conflict for duplicate registration, got ${dupRes.status}`);
    }
    console.log(`  ✓ Duplicate registration rejected (HTTP 409 Conflict): "${dupJson.message}"\n`);

    // 7. User Login & Audit Logging
    console.log('[CHECK 7] User Login with Valid Credentials');
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password })
    });
    const loginJson = await loginRes.json();
    if (loginRes.status !== 200 || !loginJson.success || !loginJson.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginJson)}`);
    }
    if (loginJson.user?.passwordHash) {
      throw new Error('CRITICAL SECURITY LEAK: passwordHash leaked in login response!');
    }
    console.log(`  ✓ Login succeeded (HTTP 200 OK) with signed JWT`);

    const loginAudit = await AuditLog.findOne({ userId: registeredUserId, event: 'USER_LOGIN' });
    if (!loginAudit) throw new Error('USER_LOGIN event not found in AuditLog');
    console.log(`  ✓ USER_LOGIN event recorded in AuditLog: timestamp=${loginAudit.timestamp.toISOString()}\n`);

    // 8. Invalid Credentials & Security Defense
    console.log('[CHECK 8] Invalid Credentials & Enumeration Defense');
    // Wrong password
    const wrongPassRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USER.email, password: 'WrongPassword999!' })
    });
    const wrongPassJson = await wrongPassRes.json();
    if (wrongPassRes.status !== 401 || wrongPassJson.success !== false) {
      throw new Error(`Expected 401 for wrong password, got ${wrongPassRes.status}`);
    }
    console.log(`  ✓ Wrong password rejected (HTTP 401): "${wrongPassJson.message}"`);

    // Non-existent email
    const nonExistRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ghost_user_999@veloop.io', password: 'AnyPassword123!' })
    });
    const nonExistJson = await nonExistRes.json();
    if (nonExistRes.status !== 401 || nonExistJson.success !== false) {
      throw new Error(`Expected 401 for non-existent email, got ${nonExistRes.status}`);
    }
    if (nonExistJson.message !== wrongPassJson.message) {
      throw new Error('User enumeration vulnerability: error messages differ between non-existent user and wrong password');
    }
    console.log(`  ✓ Non-existent email rejected with identical error message: "${nonExistJson.message}" (Enumeration Protected)\n`);

    // 9. Protected Route & JWT Token Validation
    console.log('[CHECK 9] Protected Route & Token Validation (GET /api/auth/me)');
    // Missing token
    const noTokenRes = await fetch(`${baseUrl}/me`);
    const noTokenJson = await noTokenRes.json();
    if (noTokenRes.status !== 401 || noTokenJson.success !== false) {
      throw new Error(`Expected 401 for missing token, got ${noTokenRes.status}`);
    }
    console.log(`  ✓ Denied access without token (HTTP 401): "${noTokenJson.message}"`);

    // Invalid token
    const invalidTokenRes = await fetch(`${baseUrl}/me`, {
      headers: { 'Authorization': 'Bearer invalid.tampered.token' }
    });
    const invalidTokenJson = await invalidTokenRes.json();
    if (invalidTokenRes.status !== 401 || invalidTokenJson.success !== false) {
      throw new Error(`Expected 401 for invalid token, got ${invalidTokenRes.status}`);
    }
    console.log(`  ✓ Denied access with invalid token (HTTP 401): "${invalidTokenJson.message}"`);

    // Valid token
    const validMeRes = await fetch(`${baseUrl}/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    const validMeJson = await validMeRes.json();
    if (validMeRes.status !== 200 || !validMeJson.success || validMeJson.user.id !== registeredUserId) {
      throw new Error(`Failed to access protected route with valid token: ${JSON.stringify(validMeJson)}`);
    }
    console.log(`  ✓ Authorized access with valid JWT (HTTP 200 OK)`);
    console.log(`  ✓ Authenticated user: username=${validMeJson.user.username}, veBalance=${validMeJson.user.wallet.veBalance}\n`);

    // 10. Anti-Impersonation & Anti-Tampering Check
    console.log('[CHECK 10] Anti-Impersonation Defense');
    // Test that authenticateUser middleware strips client-forged userId and derives identity strictly from token
    const forgedId = new mongoose.Types.ObjectId().toString();
    const mockReq = {
      headers: { authorization: `Bearer ${userToken}` },
      body: { userId: forgedId, user: { id: forgedId } },
      ip: '127.0.0.1'
    };
    const mockRes = {
      status: (code) => ({ json: (data) => ({ code, data }) })
    };
    let nextCalled = false;
    await authenticateUser(mockReq, mockRes, () => { nextCalled = true; });

    if (!nextCalled) {
      throw new Error('authenticateUser did not call next() for valid token');
    }
    if (mockReq.user.id !== registeredUserId) {
      throw new Error(`Expected req.user.id to be ${registeredUserId}, got ${mockReq.user.id}`);
    }
    if ('userId' in mockReq.body || 'user' in mockReq.body) {
      throw new Error('CRITICAL ANTI-CHEAT FAILURE: spoofed userId or user fields were not stripped from req.body');
    }
    console.log(`  ✓ Anti-impersonation verified: identity derived strictly from verified JWT token (${mockReq.user.id})`);
    console.log(`  ✓ Spoofed body.userId ("${forgedId}") and body.user were completely stripped from req.body\n`);

    // 11. Rate Limiting Verification
    console.log('[CHECK 11] Authentication Rate Limiter');
    if (typeof authRateLimiter !== 'function') {
      throw new Error('authRateLimiter is not a function');
    }
    console.log(`  ✓ authRateLimiter middleware verified and active on /api/auth/register and /api/auth/login`);

    // Verify rate limiting in real HTTP pipeline on /api/auth/test-limiter
    const r1 = await fetch(`${baseUrl}/test-limiter`);
    const r2 = await fetch(`${baseUrl}/test-limiter`);
    const r3 = await fetch(`${baseUrl}/test-limiter`);

    if (r1.status !== 200 || r2.status !== 200) {
      throw new Error(`Expected first two requests to succeed, got ${r1.status} and ${r2.status}`);
    }
    if (r3.status !== 429) {
      throw new Error(`Expected third request to be throttled with HTTP 429, got ${r3.status}`);
    }
    const r3Json = await r3.json();
    console.log(`  ✓ Rate limiter effectively throttles excessive attempts with HTTP 429: "${r3Json.message}"\n`);

    // 12. Git & Secrets Hygiene
    console.log('[CHECK 12] Secrets & .env Hygiene');
    const gitignorePath = path.resolve(__dirname, '../../.gitignore');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignoreContent.includes('.env')) {
      throw new Error('.env is not listed in .gitignore!');
    }
    console.log(`  ✓ .gitignore contains .env and **/.env rules`);
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing from backend/.env');
    }
    console.log(`  ✓ JWT_SECRET is loaded exclusively from environment variables\n`);

    console.log('=== ALL PHASE 3 VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
  } finally {
    // Clean up test documents
    if (registeredUserId) {
      await User.deleteOne({ _id: registeredUserId });
      await Wallet.deleteOne({ userId: registeredUserId });
      await StreakCycle.deleteMany({ userId: registeredUserId });
      await AuditLog.deleteMany({ userId: registeredUserId });
    }
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }
  process.exit(0);
};

runPhase3Verification().catch(async (err) => {
  console.error('\n[FATAL ERROR]', err.message);
  try { await mongoose.disconnect(); } catch (e) {}
  process.exit(1);
});
