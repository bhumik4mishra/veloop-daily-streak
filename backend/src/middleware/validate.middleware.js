const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

/**
 * Validate registration request body
 */
export const validateRegistration = (req, res, next) => {
  const { username, email, password } = req.body || {};

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Username is required and must be at least 3 characters long.'
    });
  }

  if (username.trim().length > 30) {
    return res.status(400).json({
      success: false,
      message: 'Username cannot exceed 30 characters.'
    });
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.'
    });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password is required and must be at least 6 characters long.'
    });
  }

  // Normalize trimmed fields
  req.body.username = username.trim();
  req.body.email = email.trim().toLowerCase();

  next();
};

/**
 * Validate login request body
 */
export const validateLogin = (req, res, next) => {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.'
    });
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Password is required.'
    });
  }

  req.body.email = email.trim().toLowerCase();

  next();
};
