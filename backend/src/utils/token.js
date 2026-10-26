import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }
  return secret;
};

/**
 * Generate a signed JWT token
 * @param {Object} payload - Data to embed in the token (e.g., id, email, role)
 * @param {string} [expiresIn] - Optional custom expiration (defaults to process.env.JWT_EXPIRES_IN or '7d')
 * @returns {string} - Signed JWT token
 */
export const generateToken = (payload, expiresIn = process.env.JWT_EXPIRES_IN || '7d') => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
};

/**
 * Verify and decode a JWT token
 * @param {string} token - The JWT string to verify
 * @returns {Object} - Decoded token payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};
