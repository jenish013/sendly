const Transfer = require('../models/Transfer');
const transferService = require('../services/transferService');
const AppError = require('../utils/appError');

const completeTransfer = async (req, res, next) => {
  try {
    const transfer = await Transfer.findOne({ transferId: req.params.id })
    if (!transfer) {
      return next(new AppError('Transfer not found', 'TRANSFER_NOT_FOUND', 404))
    }
    if (transfer.senderId.toString() !== req.user._id.toString()) {
      return next(new AppError('Forbidden', 'FORBIDDEN', 403))
    }
    if (transfer.status !== 'uploading') {
      return next(new AppError('Transfer is not in uploading status', 'VALIDATION_ERROR', 400))
    }

    const result = await transferService.completeTransfer(transfer.transferId, transfer.files)

    res.json({
      success: true,
      data: {
        transferId: result.transferId,
        status: result.status,
        message: 'Transfer completed successfully'
      }
    })
  } catch (error) {
    next(error)
  }
}

const createTransfer = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const data = {
      ...req.body,
      senderEmail: req.user.email,
      senderName: req.user.name
    };

    const transfer = await transferService.createTransfer(userId, data);

    const uploadInstructions = transfer.files.map(file => ({
      fileId: file.fileId,
      storageKey: file.storageKey,
      mimeType: file.mimeType,
      size: file.size,
      originalName: file.originalName
    }));

    res.status(201).json({
      success: true,
      data: {
        transferId: transfer.transferId,
        expiresAt: transfer.expiresAt,
        files: uploadInstructions
      }
    });
  } catch (error) {
    next(error);
  }
};

const getSentTransfers = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const sort = req.query.sort || '-createdAt';

    const query = { senderId: userId };
    if (search) {
      query.$or = [
        { transferId: { $regex: search, $options: 'i' } },
        { senderEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const transfers = await Transfer.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Transfer.countDocuments(query);

    res.json({
      success: true,
      data: {
        transfers: transfers.map(t => t.toPublicJSON()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getReceivedTransfers = async (req, res, next) => {
  try {
    const userEmail = req.user.email;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const transfers = await Transfer.find({
      'recipients.email': userEmail,
      status: { $in: ['active', 'uploading', 'processing'] }
    })
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Transfer.countDocuments({
      'recipients.email': userEmail,
      status: { $in: ['active', 'uploading', 'processing'] }
    });

    res.json({
      success: true,
      data: {
        transfers: transfers.map(t => t.toPublicJSON()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getTransfer = async (req, res, next) => {
  try {
    const transfer = await Transfer.findOne({ transferId: req.params.id });
    if (!transfer) {
      return next(new AppError('Transfer not found', 'TRANSFER_NOT_FOUND', 404));
    }

    if (transfer.senderId.toString() !== req.user._id.toString()) {
      return next(new AppError('Forbidden', 'FORBIDDEN', 403));
    }

    res.json({
      success: true,
      data: transfer.toPublicJSON()
    });
  } catch (error) {
    next(error);
  }
};

const deleteTransfer = async (req, res, next) => {
  try {
    await transferService.revokeTransfer(req.params.id, req.user._id);
    res.json({
      success: true,
      data: { message: 'Transfer revoked successfully' }
    });
  } catch (error) {
    if (error.message === 'Transfer not found') {
      return next(new AppError('Transfer not found', 'TRANSFER_NOT_FOUND', 404));
    }
    if (error.message === 'Forbidden') {
      return next(new AppError('Forbidden', 'FORBIDDEN', 403));
    }
    next(error);
  }
};

const revokeTransfer = async (req, res, next) => {
  try {
    await transferService.revokeTransfer(req.params.id, req.user._id);
    res.json({
      success: true,
      data: { message: 'Transfer revoked successfully' }
    });
  } catch (error) {
    if (error.message === 'Transfer not found') {
      return next(new AppError('Transfer not found', 'TRANSFER_NOT_FOUND', 404));
    }
    if (error.message === 'Forbidden') {
      return next(new AppError('Forbidden', 'FORBIDDEN', 403));
    }
    next(error);
  }
};

const resendEmail = async (req, res, next) => {
  try {
    await transferService.resendEmail(req.params.id, req.user._id);
    res.json({
      success: true,
      data: { message: 'Emails resent successfully' }
    });
  } catch (error) {
    if (error.message === 'Transfer not found') {
      return next(new AppError('Transfer not found', 'TRANSFER_NOT_FOUND', 404));
    }
    if (error.message === 'Forbidden') {
      return next(new AppError('Forbidden', 'FORBIDDEN', 403));
    }
    next(error);
  }
};

module.exports = {
  createTransfer,
  completeTransfer,
  getSentTransfers,
  getReceivedTransfers,
  getTransfer,
  deleteTransfer,
  revokeTransfer,
  resendEmail
};
