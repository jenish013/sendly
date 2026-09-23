const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

const auth = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Access token missing', 'UNAUTHORIZED', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return next(new AppError('User not found', 'UNAUTHORIZED', 401));
    }

    if (user.status !== 'active') {
      return next(new AppError('Account is suspended or deleted', 'FORBIDDEN', 403));
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 'UNAUTHORIZED', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 'UNAUTHORIZED', 401));
    }
    return next(new AppError('Authentication failed', 'UNAUTHORIZED', 401));
  }
};

module.exports = auth;
