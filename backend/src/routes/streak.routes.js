import express from 'express';
import {
  getStreakDashboard,
  getStreakStatusOnly,
  claimStreak,
  getStreakHistory,
  getWallet
} from '../controllers/streak.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';

const router = express.Router();

// All daily streak endpoints require verified JWT authentication
router.use(authenticateUser);

/**
 * @route   GET /api/daily-streak
 * @desc    Get full server-authoritative streak dashboard state
 * @access  Private
 */
router.get('/', getStreakDashboard);

/**
 * @route   GET /api/daily-streak/status
 * @desc    Lightweight polling endpoint for countdown re-sync and eligibility
 * @access  Private
 */
router.get('/status', getStreakStatusOnly);

/**
 * @route   POST /api/daily-streak/claim
 * @desc    Claim current eligible streak reward with atomic ledger update
 * @access  Private
 */
router.post('/claim', claimStreak);

/**
 * @route   GET /api/daily-streak/history
 * @desc    Get streak claim and cycle history
 * @access  Private
 */
router.get('/history', getStreakHistory);

/**
 * @route   GET /api/daily-streak/wallet (also mounted at /api/wallet)
 * @desc    Get current wallet balance and transaction ledger
 * @access  Private
 */
router.get('/wallet', getWallet);

export default router;
