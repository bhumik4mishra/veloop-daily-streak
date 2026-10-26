import { AuditLog } from '../models/index.js';
import { logger } from '../utils/logger.js';

/**
 * Sanitize details object to guarantee no sensitive credentials or tokens are logged
 * @param {Object} details 
 * @returns {Object} Sanitized copy
 */
const sanitizeDetails = (details = {}) => {
  if (typeof details !== 'object' || details === null) return {};
  const sanitized = { ...details };
  const sensitiveFields = ['password', 'passwordHash', 'token', 'authorization', 'secret', 'jwt'];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
};

/**
 * Log a security, authentication, or streak lifecycle audit event
 * @param {Object} params
 * @param {string|null} [params.userId] - User ID if known
 * @param {string} params.event - AuditLog event enum value
 * @param {Object} [params.details] - Non-sensitive context
 * @param {string} [params.ipAddress] - Request IP
 * @returns {Promise<AuditLog|null>}
 */
export const logAuditEvent = async ({ userId = null, event, details = {}, ipAddress = '' }) => {
  try {
    const sanitized = sanitizeDetails(details);
    const log = await AuditLog.create({
      userId: userId || null,
      event,
      details: sanitized,
      ipAddress: ipAddress || '',
      timestamp: new Date()
    });
    return log;
  } catch (error) {
    // Non-blocking failure: never crash the core application if an audit write fails
    logger.warn(`Failed to write audit log event "${event}": ${error.message}`);
    return null;
  }
};
