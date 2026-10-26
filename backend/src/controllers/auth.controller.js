import bcrypt from 'bcryptjs';
import { User, Wallet, StreakCycle } from '../models/index.js';
import { generateToken } from '../utils/token.js';
import { logAuditEvent } from '../services/audit.service.js';

/**
 * Register a new user
 * - Hashes password securely via bcrypt
 * - Creates user account
 * - Initializes default wallet with baseline 120 VEs
 * - Initializes active Cycle 1
 * - Emits USER_REGISTER audit log
 * - Returns JWT and user payload (strictly omitting password hash)
 */
export const register = async (req, res, next) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || '';
  const { username, email, password } = req.body;

  try {
    // Check duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    // Securely hash password with bcrypt (salt rounds = 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      username,
      email,
      passwordHash,
      role: 'user'
    });

    // Initialize user wallet with 120 VEs default baseline
    const wallet = await Wallet.create({
      userId: user._id,
      veBalance: 120,
      giftCardBalance: 0
    });

    // Initialize active StreakCycle 1
    const cycleId = `cycle_${user._id}_1`;
    await StreakCycle.create({
      cycleId,
      userId: user._id,
      cycleNumber: 1,
      status: 'ACTIVE',
      startedAt: new Date()
    });

    // Record audit event for user registration
    await logAuditEvent({
      userId: user._id,
      event: 'USER_REGISTER',
      details: { username: user.username, email: user.email },
      ipAddress
    });

    // Generate signed JWT
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        wallet: {
          veBalance: wallet.veBalance,
          giftCardBalance: wallet.giftCardBalance
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticate user login
 * - Validates credentials without disclosing whether email or password was wrong
 * - Emits USER_LOGIN or USER_LOGIN_FAILED audit log
 * - Returns signed JWT and user profile
 */
export const login = async (req, res, next) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || '';
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    // Protect against timing/enumeration attacks by using consistent failure responses
    if (!user) {
      await logAuditEvent({
        userId: null,
        event: 'USER_LOGIN_FAILED',
        details: { email, reason: 'User not found' },
        ipAddress
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await logAuditEvent({
        userId: user._id,
        event: 'USER_LOGIN_FAILED',
        details: { email: user.email, reason: 'Incorrect password' },
        ipAddress
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Record successful login audit event
    await logAuditEvent({
      userId: user._id,
      event: 'USER_LOGIN',
      details: { email: user.email, loginAt: new Date().toISOString() },
      ipAddress
    });

    // Fetch user wallet
    const wallet = await Wallet.findOne({ userId: user._id });

    // Generate signed JWT
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        wallet: {
          veBalance: wallet ? wallet.veBalance : 120,
          giftCardBalance: wallet ? wallet.giftCardBalance : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get profile of currently authenticated user
 * User identity is extracted strictly from the validated JWT token
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    const wallet = await Wallet.findOne({ userId: user._id });

    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        wallet: {
          veBalance: wallet ? wallet.veBalance : 120,
          giftCardBalance: wallet ? wallet.giftCardBalance : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
