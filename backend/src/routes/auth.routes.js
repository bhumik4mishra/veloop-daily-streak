import express from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import { validateRegistration, validateLogin } from '../middleware/validate.middleware.js';
import { authRateLimiter, testableAuthLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * @route   GET /api/auth/test-limiter
 * @desc    Dedicated verification endpoint for rate limit behavior
 * @access  Public (Rate limited to 2 req/min for testing)
 */
router.get('/test-limiter', testableAuthLimiter(2, 60000), (req, res) => {
  res.status(200).json({ success: true, message: 'Limiter test passed' });
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user, initialize wallet & streak cycle, issue JWT
 * @access  Public (Rate limited)
 */
router.post('/register', authRateLimiter, validateRegistration, register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate credentials, audit login event, issue JWT
 * @access  Public (Rate limited)
 */
router.post('/login', authRateLimiter, validateLogin, login);

/**
 * @route   GET /api/auth/me
 * @desc    Retrieve profile & wallet of currently authenticated user
 * @access  Private (JWT Protected)
 */
router.get('/me', authenticateUser, getMe);

export default router;
