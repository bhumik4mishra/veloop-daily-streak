import {
  StreakConfig,
  StreakReward,
  StreakCycle,
  StreakClaim,
  Wallet,
  WalletTransaction
} from '../models/index.js';
import { logAuditEvent } from './audit.service.js';

/**
 * Fetch active streak configuration or return defaults
 */
export const getActiveConfig = async () => {
  const config = await StreakConfig.findOne({ isActive: true });
  if (config) return config;

  return {
    configKey: 'DEFAULT_7_DAY',
    cycleLengthDays: 7,
    claimIntervalHours: 24,
    gracePeriodHours: 24,
    timezone: 'UTC'
  };
};

/**
 * Get the currently active streak cycle for a user, or spawn a fresh Cycle 1
 */
export const getActiveOrCreateCycle = async (userId, serverTime = new Date()) => {
  let activeCycle = await StreakCycle.findOne({ userId, status: 'ACTIVE' });
  if (activeCycle) return activeCycle;

  // Check the latest cycle to calculate the next cycle number
  const latestCycle = await StreakCycle.findOne({ userId }).sort({ cycleNumber: -1 });
  const nextCycleNumber = latestCycle ? latestCycle.cycleNumber + 1 : 1;
  const cycleId = `cycle_${userId}_${nextCycleNumber}_${Date.now()}`;

  activeCycle = await StreakCycle.create({
    cycleId,
    userId,
    cycleNumber: nextCycleNumber,
    status: 'ACTIVE',
    startedAt: serverTime
  });

  return activeCycle;
};

/**
 * Calculate full server-authoritative streak state, handling timers, progression, and missed-day resets
 * @param {string} userId - Authenticated user ObjectId
 * @param {Date} [serverTime=new Date()] - Reference server time
 * @param {string} [ipAddress=''] - Request IP for audit logging
 */
export const calculateStreakState = async (userId, serverTime = new Date(), ipAddress = '') => {
  const config = await getActiveConfig();
  let activeCycle = await getActiveOrCreateCycle(userId, serverTime);

  // Fetch all claims for current active cycle
  let claims = await StreakClaim.find({
    userId,
    cycleId: activeCycle.cycleId,
    status: 'CLAIMED'
  }).sort({ day: 1 });

  const intervalMs = config.claimIntervalHours * 3600 * 1000;
  const graceMs = config.gracePeriodHours * 3600 * 1000;
  let didReset = false;

  // MISSED-DAY DETECTION:
  // If claims exist in this cycle, verify that user has not exceeded the 24h claim window + 24h grace window
  if (claims.length > 0 && claims.length < config.cycleLengthDays) {
    const lastClaim = claims[claims.length - 1];
    const lastClaimTime = new Date(lastClaim.claimedAt).getTime();
    const nextClaimTime = lastClaimTime + intervalMs;
    const windowExpiresTime = nextClaimTime + graceMs;

    if (serverTime.getTime() > windowExpiresTime) {
      // Missed-day window expired! Reset current cycle to RESET and spawn new cycle
      activeCycle.status = 'RESET';
      await activeCycle.save();

      await logAuditEvent({
        userId,
        event: 'STREAK_RESET',
        details: {
          reason: 'MISSED_CLAIM_WINDOW',
          previousCycleId: activeCycle.cycleId,
          cycleNumber: activeCycle.cycleNumber,
          lastClaimedDay: lastClaim.day,
          lastClaimedAt: lastClaim.claimedAt,
          windowExpiredAt: new Date(windowExpiresTime).toISOString(),
          resetAt: serverTime.toISOString()
        },
        ipAddress
      });

      // Spawn fresh active cycle starting back at Day 1
      activeCycle = await StreakCycle.create({
        cycleId: `cycle_${userId}_${activeCycle.cycleNumber + 1}_${Date.now()}`,
        userId,
        cycleNumber: activeCycle.cycleNumber + 1,
        status: 'ACTIVE',
        startedAt: serverTime
      });

      claims = []; // Reset claims in the new cycle
      didReset = true;
    }
  }

  // Check if active cycle is already completed (Day 7 claimed)
  if (claims.length >= config.cycleLengthDays) {
    const lastClaim = claims[claims.length - 1];
    const lastClaimTime = new Date(lastClaim.claimedAt).getTime();
    const nextCycleAvailableTime = lastClaimTime + intervalMs;

    // If 24 hours have elapsed since Day 7 claim, auto-start Cycle N+1
    if (serverTime.getTime() >= nextCycleAvailableTime) {
      if (activeCycle.status === 'ACTIVE') {
        activeCycle.status = 'COMPLETED';
        activeCycle.completedAt = new Date(lastClaimTime);
        await activeCycle.save();
      }

      activeCycle = await StreakCycle.create({
        cycleId: `cycle_${userId}_${activeCycle.cycleNumber + 1}_${Date.now()}`,
        userId,
        cycleNumber: activeCycle.cycleNumber + 1,
        status: 'ACTIVE',
        startedAt: serverTime
      });

      claims = []; // New cycle starts fresh at Day 1
    }
  }

  // Calculate timing & eligibility
  const currentStreak = claims.length; // Consecutive days completed in active cycle
  const eligibleDay = currentStreak + 1; // Next day to claim (1 - 7)
  let canClaimToday = false;
  let nextClaimAt = null;
  let nextClaimInSeconds = 0;

  if (currentStreak === 0) {
    // New cycle or freshly reset: Day 1 is immediately available
    canClaimToday = true;
    nextClaimAt = serverTime;
    nextClaimInSeconds = 0;
  } else if (currentStreak < config.cycleLengthDays) {
    const lastClaim = claims[claims.length - 1];
    const lastClaimTime = new Date(lastClaim.claimedAt).getTime();
    const targetTime = lastClaimTime + intervalMs;
    nextClaimAt = new Date(targetTime);

    if (serverTime.getTime() >= targetTime) {
      canClaimToday = true;
      nextClaimInSeconds = 0;
    } else {
      canClaimToday = false;
      nextClaimInSeconds = Math.max(0, Math.ceil((targetTime - serverTime.getTime()) / 1000));
    }
  } else {
    // Current cycle is fully claimed (Day 7), waiting for next cycle
    const lastClaim = claims[claims.length - 1];
    const targetTime = new Date(lastClaim.claimedAt).getTime() + intervalMs;
    nextClaimAt = new Date(targetTime);
    canClaimToday = false;
    nextClaimInSeconds = Math.max(0, Math.ceil((targetTime - serverTime.getTime()) / 1000));
  }

  // Fetch all 7 reward configurations
  const rewards = await StreakReward.find({ $or: [{ active: true }, { isActive: true }] }).sort({ day: 1 });

  // Generate 7-card state array matching UI requirements
  const cards = rewards.map((r) => {
    const isClaimed = r.day <= currentStreak;
    const isActionable = r.day === eligibleDay && canClaimToday;
    const isTodayLocked = r.day === eligibleDay && !canClaimToday;
    const isFuture = r.day > eligibleDay;

    let status = 'LOCKED';
    if (isClaimed) {
      status = 'CLAIMED';
    } else if (isActionable) {
      status = 'AVAILABLE';
    } else if (isTodayLocked) {
      status = 'LOCKED';
    } else if (isFuture) {
      status = 'LOCKED';
    }

    const matchedClaim = claims.find((c) => c.day === r.day);

    return {
      day: r.day,
      rewardType: r.rewardType,
      currency: r.currency,
      amount: r.amount,
      title: r.title,
      subtitle: r.subtitle,
      badgeText: r.badgeText,
      assetType: r.assetType,
      isUltimate: r.isUltimate,
      status,
      isClaimed,
      isActionable,
      claimedAt: matchedClaim ? matchedClaim.claimedAt : null
    };
  });

  // Fetch user wallet
  const wallet = await Wallet.findOne({ userId });

  // Lifetime metrics across all cycles
  const lifetimeClaimsCount = await StreakClaim.countDocuments({ userId });
  const completedCyclesCount = await StreakCycle.countDocuments({ userId, status: 'COMPLETED' });

  // Ultimate reward (Day 7)
  const ultimateReward = rewards.find((r) => r.isUltimate) || rewards[rewards.length - 1];

  return {
    serverTime: serverTime.toISOString(),
    config: {
      cycleLengthDays: config.cycleLengthDays,
      claimIntervalHours: config.claimIntervalHours,
      gracePeriodHours: config.gracePeriodHours
    },
    cycle: {
      cycleId: activeCycle.cycleId,
      cycleNumber: activeCycle.cycleNumber,
      status: activeCycle.status,
      startedAt: activeCycle.startedAt
    },
    streak: {
      currentStreak,
      totalCycleDays: config.cycleLengthDays,
      eligibleDay: Math.min(eligibleDay, config.cycleLengthDays),
      canClaimToday,
      nextClaimAt: nextClaimAt ? nextClaimAt.toISOString() : null,
      nextClaimInSeconds,
      didReset
    },
    statistics: {
      checkedInDays: currentStreak,
      totalRewards: config.cycleLengthDays,
      lifetimeClaims: lifetimeClaimsCount,
      completedCycles: completedCyclesCount
    },
    cards,
    ultimateReward,
    wallet: {
      veBalance: wallet ? wallet.veBalance : 120,
      giftCardBalance: wallet ? wallet.giftCardBalance : 0
    }
  };
};
