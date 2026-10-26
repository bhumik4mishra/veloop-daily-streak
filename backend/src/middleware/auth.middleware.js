import { verifyToken } from '../utils/token.js';
import { logAuditEvent } from '../services/audit.service.js';

/**
 * Authenticate incoming requests using Bearer JWT
 * Derives user identity strictly from verified token, preventing impersonation attacks.
 */
export const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const ipAddress = req.ip || req.connection?.remoteAddress || '';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await logAuditEvent({
      userId: null,
      event: 'AUTH_UNAUTHORIZED',
      details: { reason: 'Missing or malformed Authorization header', path: req.originalUrl },
      ipAddress
    });

    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.'
    });
  }

  const token = authHeader.split(' ')[1]?.trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.'
    });
  }

  try {
    const decoded = verifyToken(token);

    // Strictly bind user identity from the validated JWT
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user'
    };

    // ANTI-CHEAT / ANTI-IMPERSONATION:
    // Strip or override any spoofed userId or user fields provided in request body
    if (req.body && typeof req.body === 'object') {
      if ('userId' in req.body) {
        delete req.body.userId;
      }
      if ('user' in req.body) {
        delete req.body.user;
      }
    }

    next();
  } catch (error) {
    await logAuditEvent({
      userId: null,
      event: 'AUTH_UNAUTHORIZED',
      details: { reason: 'Token verification failed', errorName: error.name, path: req.originalUrl },
      ipAddress
    });

    return res.status(401).json({
      success: false,
      message: error.name === 'TokenExpiredError' 
        ? 'Session expired. Please log in again.' 
        : 'Invalid or expired authentication token.'
    });
  }
};

/**
 * Restrict route access to admin users
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Administrator privileges required.'
    });
  }
  next();
};
