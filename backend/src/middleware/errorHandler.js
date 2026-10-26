import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });

  // Map known internal error types to user-friendly messages
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Unable to process your request. Please try again.';

  if (err.name === 'CastError' || err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Invalid request parameters.';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry detected.';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication failed. Please log in to continue.';
  } else if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Unable to process your reward. Please try again.';
  }

  res.status(statusCode).json({
    success: false,
    message
  });
};
