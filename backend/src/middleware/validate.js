const AppError = require('../utils/appError');

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
    return next(new AppError('Name must be between 2 and 50 characters', 'VALIDATION_ERROR', 400));
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    return next(new AppError('Valid email is required', 'VALIDATION_ERROR', 400));
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return next(new AppError('Password must be at least 8 characters', 'VALIDATION_ERROR', 400));
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return next(new AppError('Email is required', 'VALIDATION_ERROR', 400));
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    return next(new AppError('Password is required', 'VALIDATION_ERROR', 400));
  }

  next();
};

const validateCreateTransfer = (req, res, next) => {
  const { recipients, files, message, passwordProtected, password, expiresIn } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return next(new AppError('At least one recipient is required', 'VALIDATION_ERROR', 400));
  }

  for (const r of recipients) {
    if (!r || !r.email || typeof r.email !== 'string') {
      return next(new AppError('Each recipient must have a valid email', 'VALIDATION_ERROR', 400));
    }
  }

  if (!Array.isArray(files) || files.length === 0) {
    return next(new AppError('At least one file is required', 'VALIDATION_ERROR', 400));
  }

  for (const f of files) {
    if (!f.fileId || !f.originalName || !f.mimeType || typeof f.size !== 'number') {
      return next(new AppError('Invalid file metadata', 'VALIDATION_ERROR', 400));
    }
  }

  if (passwordProtected) {
    if (!password || typeof password !== 'string' || password.length < 4) {
      return next(new AppError('Password must be at least 4 characters when password protection is enabled', 'VALIDATION_ERROR', 400));
    }
  }

  next();
};

const validateFileUpload = (req, res, next) => {
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateTransfer,
  validateFileUpload
};
