const Transfer = require('../models/Transfer');
const transferService = require('../services/transferService');
const storageService = require('../services/storageService');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const fs = require('fs');

const getPublicTransfer = async (req, res, next) => {
  try {
    const { transferId } = req.params;
    const transfer = await Transfer.findOne({ transferId, status: 'active' });

    if (!transfer) {
      return next(new AppError('Transfer not found', 'TRANSFER_NOT_FOUND', 404));
    }

    if (transfer.isExpired()) {
      return next(new AppError('Transfer expired', 'TRANSFER_EXPIRED', 410));
    }

    if (transfer.status === 'revoked') {
      return next(new AppError('Transfer has been revoked', 'TRANSFER_REVOKED', 410));
    }

    res.json({
      success: true,
      data: transfer.toPublicJSON()
    });
  } catch (error) {
    next(error);
  }
};

const verifyPassword = async (req, res, next) => {
  try {
    const { transferId } = req.params;
    const { password } = req.body;

    const transfer = await Transfer.findOne({ transferId });
    if (!transfer) {
      return next(new AppError('Transfer not found', 'TRANSFER_NOT_FOUND', 404));
    }

    if (!transfer.passwordProtected) {
      return next(new AppError('Transfer is not password protected', 'VALIDATION_ERROR', 400));
    }

    await transferService.verifyPassword(transferId, password);

    const sessionToken = jwt.sign(
      { transferId, type: 'transfer-session' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      data: { sessionToken }
    });
  } catch (error) {
    if (error.message === 'Invalid password') {
      return next(new AppError('Invalid password', 'INVALID_PASSWORD', 401));
    }
    if (error.message === 'Transfer not found') {
      return next(new AppError('Transfer not found', 'TRANSFER_NOT_FOUND', 404));
    }
    next(error);
  }
};

const downloadFile = async (req, res, next) => {
  try {
    const { transferId, fileId } = req.params;

    const transfer = await Transfer.findOne({ transferId });
    if (!transfer) {
      logger.error(`Transfer not found: ${transferId}`)
      return next(new AppError('Transfer not found', 'TRANSFER_NOT_FOUND', 404));
    }

    if (transfer.status !== 'active') {
      if (transfer.status === 'expired') {
        return next(new AppError('Transfer expired', 'TRANSFER_EXPIRED', 410));
      }
      if (transfer.status === 'revoked') {
        return next(new AppError('Transfer revoked', 'TRANSFER_REVOKED', 410));
      }
      return next(new AppError('Transfer not available', 'TRANSFER_NOT_FOUND', 404));
    }

    if (transfer.isExpired()) {
      return next(new AppError('Transfer expired', 'TRANSFER_EXPIRED', 410));
    }

    const file = transfer.files.find(f => f.fileId === fileId);
    if (!file) {
      logger.error(`File not found in transfer: ${transferId}, fileId: ${fileId}, files: ${JSON.stringify(transfer.files.map(f => f.fileId))}`)
      return next(new AppError('File not found', 'TRANSFER_NOT_FOUND', 404));
    }

    if (transfer.passwordProtected) {
      const sessionToken = req.headers['x-session-token'] || req.query.session;
      if (!sessionToken) {
        return next(new AppError('Password required', 'UNAUTHORIZED', 401));
      }

      try {
        const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
        if (decoded.transferId !== transferId) {
          return next(new AppError('Invalid session', 'UNAUTHORIZED', 401));
        }
      } catch (error) {
        return next(new AppError('Invalid or expired session', 'UNAUTHORIZED', 401));
      }
    }

    const recipientEmail = req.query.email;
    if (recipientEmail) {
      await transferService.recordDownload(transferId, fileId, recipientEmail);
    }

    const filePath = await storageService.getFilePath(file.storageKey);
    if (!filePath || !fs.existsSync(filePath)) {
      logger.error(`File not found on disk: ${file.storageKey}, expected path: ${filePath}`)
      return next(new AppError('File not found in storage', 'TRANSFER_NOT_FOUND', 404));
    }

    logger.info(`Downloading file: ${filePath}, originalName: ${file.originalName}`)
    
    const encodedFilename = encodeURIComponent(file.originalName)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}; filename="${encodedFilename}"`);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');

    const fileSize = fs.statSync(filePath).size;
    res.setHeader('Content-Length', fileSize);

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).header({
          'Content-Range': `bytes */${fileSize}`
        }).end();
        return;
      }

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', end - start + 1);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);

      stream.on('error', (err) => {
        logger.error(`File stream error: ${err.message}`);
        if (!res.headersSent) {
          next(err);
        }
      });
    } else {
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (err) => {
        logger.error(`File stream error: ${err.message}`);
        if (!res.headersSent) {
          next(err);
        }
      });
    }
  } catch (error) {
    logger.error(`Download file failed: ${error.message}`);
    if (error.message === 'File not found') {
      return next(new AppError('File not found', 'TRANSFER_NOT_FOUND', 404));
    }
    next(error);
  }
};

module.exports = {
  getPublicTransfer,
  verifyPassword,
  downloadFile
};
