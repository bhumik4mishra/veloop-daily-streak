import { calculateStreakState } from '../services/streak.service.js';
import { claimDailyReward } from '../services/claim.service.js';
import { StreakClaim, StreakCycle, Wallet, WalletTransaction } from '../models/index.js';

/**
 * GET /api/daily-streak
 * Returns full server-authoritative streak dashboard state
 */
export const getStreakDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection?.remoteAddress || '';
    const state = await calculateStreakState(userId, new Date(), ipAddress);

    return res.status(200).json({
      success: true,
      data: state
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/daily-streak/status
 * Lightweight endpoint for polling countdown timer and checking claim eligibility
 */
export const getStreakStatusOnly = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection?.remoteAddress || '';
    const state = await calculateStreakState(userId, new Date(), ipAddress);

    return res.status(200).json({
      success: true,
      serverTime: state.serverTime,
      canClaimToday: state.streak.canClaimToday,
      nextClaimAt: state.streak.nextClaimAt,
      nextClaimInSeconds: state.streak.nextClaimInSeconds,
      currentStreak: state.streak.currentStreak,
      eligibleDay: state.streak.eligibleDay,
      cycleNumber: state.cycle.cycleNumber
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/daily-streak/claim
 * Execute atomic daily reward claim
 */
export const claimStreak = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection?.remoteAddress || '';
    const requestedDay = req.body?.day;

    const result = await claimDailyReward({
      userId,
      requestedDay,
      ipAddress,
      serverTime: new Date()
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/daily-streak/history
 * Fetch historical claim ledger and cycle records
 */
export const getStreakHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const claims = await StreakClaim.find({ userId })
      .populate('rewardId', 'title subtitle amount currency rewardType isUltimate assetType')
      .sort({ claimedAt: -1 })
      .limit(50);

    const cycles = await StreakCycle.find({ userId })
      .sort({ startedAt: -1 })
      .limit(20);

    const transactions = await WalletTransaction.find({ userId, source: 'DAILY_STREAK' })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      data: {
        totalClaims: claims.length,
        claims,
        cycles,
        transactions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/wallet
 * Fetch authenticated user's current wallet and ledger history
 */
export const getWallet = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const wallet = await Wallet.findOne({ userId });
    const transactions = await WalletTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(25);

    return res.status(200).json({
      success: true,
      data: {
        balances: {
          veBalance: wallet ? wallet.veBalance : 120,
          giftCardBalance: wallet ? wallet.giftCardBalance : 0
        },
        recentTransactions: transactions
      }
    });
  } catch (error) {
    next(error);
  }
};
