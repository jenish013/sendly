const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: message || 'Too many requests, please try again later.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for ${req.ip} on ${req.originalUrl}`);
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: message || 'Too many requests, please try again later.'
        }
      });
    }
  });
};

const authLimiter = createRateLimiter(
  15 * 60 * 1000,
  10,
  'Too many authentication attempts, please try again after 15 minutes.'
);

const transferLimiter = createRateLimiter(
  60 * 1000,
  20,
  'Too many transfer requests, please slow down.'
);

const uploadLimiter = createRateLimiter(
  60 * 1000,
  process.env.NODE_ENV === 'development' ? 500 : 30,
  'Too many upload requests, please slow down.'
);

module.exports = {
  authLimiter,
  transferLimiter,
  uploadLimiter
};
