import mongoose from 'mongoose';
import {
  StreakReward,
  StreakClaim,
  StreakCycle,
  Wallet,
  WalletTransaction
} from '../models/index.js';
import { calculateStreakState } from './streak.service.js';
import { logAuditEvent } from './audit.service.js';

/**
 * Atomically claim daily streak reward with double-click and concurrency protection
 * @param {Object} params
 * @param {string} params.userId - Authenticated user ObjectId
 * @param {number} [params.requestedDay] - Optional client requested day (validated against eligibleDay)
 * @param {string} [params.ipAddress=''] - Request IP for audit logging
 * @param {Date} [params.serverTime=new Date()] - Authoritative server time
 * @param {boolean} [params._simulateFailureAfterWalletUpdate=false] - For testing rollback consistency
 * @returns {Promise<Object>} Fresh state, claimed reward, and transaction details
 */
export const claimDailyReward = async ({
  userId,
  requestedDay = null,
  ipAddress = '',
  serverTime = new Date(),
  _simulateFailureAfterWalletUpdate = false
}) => {
  // 1. Calculate current state and evaluate server timers
  const state = await calculateStreakState(userId, serverTime, ipAddress);

  // 2. Validate timing eligibility
  if (!state.streak.canClaimToday) {
    await logAuditEvent({
      userId,
      event: 'STREAK_CLAIM_REJECTED',
      details: {
        reason: 'WAITING_PERIOD_ACTIVE',
        currentStreak: state.streak.currentStreak,
        eligibleDay: state.streak.eligibleDay,
        nextClaimAt: state.streak.nextClaimAt,
        nextClaimInSeconds: state.streak.nextClaimInSeconds
      },
      ipAddress
    });

    const error = new Error(
      `Reward is not yet available. Next claim opens in ${state.streak.nextClaimInSeconds} seconds.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 3. Determine authoritative eligible day
  const targetDay = state.streak.eligibleDay;

  // Anti-tampering: If client supplied a day in body, ensure it strictly matches eligibleDay
  if (requestedDay !== null && requestedDay !== undefined) {
    const parsedDay = Number(requestedDay);
    if (isNaN(parsedDay) || parsedDay !== targetDay) {
      await logAuditEvent({
        userId,
        event: 'INVALID_CLAIM',
        details: {
          requestedDay,
          expectedDay: targetDay,
          reason: 'DAY_MISMATCH_OR_SKIP_ATTEMPT'
        },
        ipAddress
      });

      const error = new Error(`Invalid claim request. Next eligible reward is Day ${targetDay}.`);
      error.statusCode = 400;
      throw error;
    }
  }

  // 4. Fetch reward configuration for the target day from database
  const reward = await StreakReward.findOne({ day: targetDay, $or: [{ active: true }, { isActive: true }] });
  if (!reward) {
    const error = new Error(`Reward configuration for Day ${targetDay} not found.`);
    error.statusCode = 500;
    throw error;
  }

  // 5. Generate unique transaction identifiers
  const claimId = `claim_${userId}_${state.cycle.cycleId}_${targetDay}`;
  const transactionId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const referenceId = `STREAK-D${targetDay}-${Date.now().toString(36).toUpperCase()}`;

  // 6. ATOMIC ACID TRANSACTION: StreakClaim, Wallet, WalletTransaction, and StreakCycle
  // Guarantees all documents are committed together or rolled back completely on any failure
  const session = await mongoose.startSession();
  session.startTransaction();

  let transactionRecord = null;
  let balanceBefore = 0;
  let balanceAfter = 0;

  try {
    // 6a. Unique compound index constraint { userId: 1, cycleId: 1, day: 1 } guarantees duplicate/race safety
    const [streakClaim] = await StreakClaim.create(
      [
        {
          claimId,
          userId,
          cycleId: state.cycle.cycleId,
          day: targetDay,
          rewardId: reward._id,
          status: 'CLAIMED',
          claimedAt: serverTime,
          transactionId
        }
      ],
      { session }
    );

    // 6b. Atomic Wallet Update inside session
    const wallet = await Wallet.findOne({ userId }).session(session);

    let updateQuery = {};
    if (reward.rewardType === 'VES') {
      balanceBefore = wallet ? wallet.veBalance : 0;
      balanceAfter = balanceBefore + reward.amount;
      updateQuery = { $inc: { veBalance: reward.amount } };
    } else if (reward.rewardType === 'GIFT_CARD') {
      balanceBefore = wallet ? wallet.giftCardBalance : 0;
      balanceAfter = balanceBefore + reward.amount;
      updateQuery = { $inc: { giftCardBalance: reward.amount } };
    }

    await Wallet.findOneAndUpdate(
      { userId },
      updateQuery,
      { upsert: true, new: true, session }
    );

    // Simulated failure hook for testing rollback consistency
    if (_simulateFailureAfterWalletUpdate) {
      throw new Error('SIMULATED_FAILURE_AFTER_WALLET_UPDATE');
    }

    // 6c. Immutable transaction ledger record inside session
    const [createdTxn] = await WalletTransaction.create(
      [
        {
          transactionId,
          userId,
          currency: reward.currency,
          type: 'CREDIT',
          amount: reward.amount,
          source: 'DAILY_STREAK',
          referenceId,
          streakDay: targetDay,
          balanceBefore,
          balanceAfter,
          status: 'SUCCESS'
        }
      ],
      { session }
    );
    transactionRecord = createdTxn;

    // 6d. Cycle Completion Handling (Day 7) inside session
    if (targetDay === state.config.cycleLengthDays) {
      await StreakCycle.findOneAndUpdate(
        { cycleId: state.cycle.cycleId },
        {
          status: 'COMPLETED',
          completedAt: serverTime
        },
        { session }
      );
    }

    // Commit all changes atomically
    await session.commitTransaction();
  } catch (err) {
    // Abort transaction: rolls back StreakClaim, Wallet update, and any uncommitted ledger operations
    await session.abortTransaction();

    if (err.code === 11000) {
      // Caught duplicate concurrent claim!
      await logAuditEvent({
        userId,
        event: 'DUPLICATE_CLAIM',
        details: {
          cycleId: state.cycle.cycleId,
          day: targetDay,
          reason: 'UNIQUE_COMPOUND_INDEX_COLLISION'
        },
        ipAddress
      });

      const dupError = new Error('Reward has already been claimed for this day.');
      dupError.statusCode = 409;
      throw dupError;
    }

    throw err;
  } finally {
    session.endSession();
  }

  // 9. Audit Event (logged outside transaction: non-blocking and audit trail preserved)
  await logAuditEvent({
    userId,
    event: 'STREAK_CLAIM_SUCCESS',
    details: {
      cycleId: state.cycle.cycleId,
      day: targetDay,
      rewardType: reward.rewardType,
      amount: reward.amount,
      currency: reward.currency,
      transactionId,
      referenceId,
      balanceAfter
    },
    ipAddress
  });

  // 10. Re-calculate fresh authoritative state to return to client
  const freshState = await calculateStreakState(userId, serverTime, ipAddress);

  return {
    success: true,
    message: `Day ${targetDay} reward successfully claimed!`,
    claimedReward: {
      day: targetDay,
      title: reward.title,
      subtitle: reward.subtitle,
      amount: reward.amount,
      currency: reward.currency,
      rewardType: reward.rewardType,
      isUltimate: reward.isUltimate
    },
    transaction: {
      transactionId: transactionRecord.transactionId,
      referenceId: transactionRecord.referenceId,
      amount: transactionRecord.amount,
      currency: transactionRecord.currency,
      balanceBefore,
      balanceAfter,
      createdAt: transactionRecord.createdAt
    },
    streakState: freshState
  };
};


