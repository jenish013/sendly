const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10737418240', 10);
const MAX_FILES_PER_TRANSFER = parseInt(process.env.MAX_FILES_PER_TRANSFER || '10', 10);

const ensureUploadsDir = () => {
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
};

if (STORAGE_PROVIDER === 'local') {
  ensureUploadsDir();
}

const dangerousFilenamePattern = /(\.\.\/|\.\.\\|[\x00-\x1f\x7f])/;

const sanitizeFilename = (filename) => {
  if (!filename) return 'unnamed';
  const basename = path.basename(filename);
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (sanitized.length > 200) {
    return sanitized.slice(-200);
  }
  return sanitized || 'unnamed';
};

const storageForPart = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadId = req.params.uploadId;
    const dir = path.join(__dirname, '..', '..', 'uploads', 'multipart', uploadId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const partNumber = req.query.partNumber || req.body.partNumber || '1';
    cb(null, `part_${partNumber}`);
  }
});

const uploadPartMiddleware = multer({
  storage: storageForPart,
  limits: {
    fileSize: process.env.NODE_ENV === 'development' ? 500 * 1024 * 1024 : MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    const filename = file.originalname;
    if (dangerousFilenamePattern.test(filename)) {
      return cb(new AppError('Invalid filename', 'INVALID_FILE_TYPE', 400), false);
    }
    cb(null, true);
  }
}).single('file');

const uploadPart = (req, res, next) => {
  if (STORAGE_PROVIDER !== 'local') {
    return next();
  }
  uploadPartMiddleware(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File too large', 'FILE_TOO_LARGE', 413));
      }
      return next(err);
    }
    next();
  });
};

const validateFileUpload = (req, res, next) => {
  if (STORAGE_PROVIDER !== 'local') {
    return next();
  }
  if (!req.file) {
    return next(new AppError('No file uploaded', 'UPLOAD_FAILED', 400));
  }
  next();
};

const validateFileMetadata = (req, res, next) => {
  const { files } = req.body;

  if (!Array.isArray(files) || files.length === 0) {
    return next(new AppError('Files metadata is required', 'VALIDATION_ERROR', 400));
  }

  if (files.length > MAX_FILES_PER_TRANSFER) {
    return next(new AppError(`Maximum ${MAX_FILES_PER_TRANSFER} files allowed`, 'VALIDATION_ERROR', 400));
  }

  for (const file of files) {
    if (!file.originalName || !file.mimeType || typeof file.size !== 'number') {
      return next(new AppError('Invalid file metadata', 'VALIDATION_ERROR', 400));
    }
  }

  next();
};

module.exports = {
  uploadPart,
  validateFileUpload,
  validateFileMetadata,
  sanitizeFilename,
  MAX_FILE_SIZE,
  MAX_FILES_PER_TRANSFER
};
