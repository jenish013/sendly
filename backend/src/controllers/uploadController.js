const fs = require('fs');
const storageService = require('../services/storageService');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

const createMultipartUpload = async (req, res, next) => {
  try {
    const { key, partCount = 1, mimeType } = req.body;

    if (!key) {
      return next(new AppError('Storage key is required', 'VALIDATION_ERROR', 400));
    }

    const result = await storageService.createMultipartUpload(key, mimeType || 'application/octet-stream');

    const response = {
      uploadId: result.uploadId,
      key: result.key,
      storageProvider: storageService.getProvider()
    };

    if (storageService.getProvider() !== 'local') {
      const presignedUrls = await storageService.getPresignedUploadUrls(key, result.uploadId, partCount);
      response.presignedUrls = presignedUrls;
    } else {
      response.uploadPartUrl = `/api/v1/uploads/${result.uploadId}/part`;
    }

    res.status(201).json({
      success: true,
      data: response
    });
  } catch (error) {
    logger.error(`Create multipart upload failed: ${error.message}`);
    next(new AppError('Failed to create multipart upload', 'UPLOAD_FAILED', 500));
  }
};

const uploadPart = async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    const { key, partNumber } = { ...req.query, ...req.body };

    if (!key) {
      return next(new AppError('Storage key is required', 'VALIDATION_ERROR', 400));
    }

    if (!partNumber) {
      return next(new AppError('Part number is required', 'VALIDATION_ERROR', 400));
    }

    if (storageService.getProvider() === 'local') {
      if (!req.file || (!req.file.buffer && !req.file.path)) {
        return next(new AppError('No file part data provided', 'UPLOAD_FAILED', 400));
      }

      if (req.file.path) {
        return res.json({
          success: true,
          data: {
            partNumber: parseInt(partNumber),
            etag: `local-${partNumber}`
          }
        });
      }

      const result = await storageService.uploadPart(key, uploadId, parseInt(partNumber), req.file.buffer);
      res.json({ success: true, data: result });
    } else {
      res.json({
        success: true,
        data: {
          uploadId,
          key,
          partNumber: parseInt(partNumber),
          confirmed: true
        }
      });
    }
  } catch (error) {
    logger.error(`Upload part failed: ${error.message}`);
    next(new AppError('Failed to upload part', 'UPLOAD_FAILED', 500));
  }
};

const completeMultipartUpload = async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    const { key, parts } = req.body;

    if (!key) {
      return next(new AppError('Storage key is required', 'VALIDATION_ERROR', 400));
    }

    const result = await storageService.completeMultipartUpload(key, uploadId, parts || []);

    res.json({
      success: true,
      data: {
        key: result.key,
        location: result.location || result.path || `/uploads/${result.key}`
      }
    });
  } catch (error) {
    logger.error(`Complete multipart upload failed: ${error.message}`);
    next(new AppError('Failed to complete multipart upload', 'UPLOAD_FAILED', 500));
  }
};

const abortMultipartUpload = async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    const { key } = req.body || req.query;

    if (!key) {
      return next(new AppError('Storage key is required', 'VALIDATION_ERROR', 400));
    }

    await storageService.abortMultipartUpload(key, uploadId);
    res.json({ success: true, data: { message: 'Upload aborted successfully' } });
  } catch (error) {
    logger.error(`Abort multipart upload failed: ${error.message}`);
    next(new AppError('Failed to abort upload', 'UPLOAD_FAILED', 500));
  }
};

module.exports = {
  createMultipartUpload,
  uploadPart,
  completeMultipartUpload,
  abortMultipartUpload
};
