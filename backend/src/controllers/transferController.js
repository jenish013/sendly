const Transfer = require('../models/Transfer');
const transferService = require('../services/transferService');
const emailService = require('../services/emailService');
const AppError = require('../utils/appError');

const serializeTransfer = async (transfer, includeRecipients = false) => {
  const data = includeRecipients ? transfer.toSenderJSON() : transfer.toPublicJSON();
  const transferUrl = emailService.getTransferUrl(transfer, transfer.publicOrigin);
  const qrCodeUrl = await emailService.getQrCodeUrl(transferUrl);
  return {
    ...data,
    transferUrl,
    qrCodeUrl
  };
};

const serializeRecipients = (recipients) => (recipients || []).map(recipient => ({
  email: recipient.email,
  name: recipient.name,
  status: recipient.status,
  emailStatus: recipient.emailStatus,
  emailError: recipient.emailError,
  emailProvider: recipient.emailProvider,
  emailMessageId: recipient.emailMessageId,
  notifiedAt: recipient.notifiedAt,
  lastEmailAttemptAt: recipient.lastEmailAttemptAt,
  downloadedAt: recipient.downloadedAt
}));

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

    const serializedTransfer = await serializeTransfer(result.transfer, true);
    res.json({
      success: true,
      data: {
        transferId: serializedTransfer.transferId,
        status: serializedTransfer.status,
        transferUrl: serializedTransfer.transferUrl,
        qrCodeUrl: serializedTransfer.qrCodeUrl,
        message: 'Transfer completed successfully',
        emailResults: result.emailResults,
        recipients: serializeRecipients(result.transfer.recipients)
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
        transfers: await Promise.all(transfers.map(transfer => serializeTransfer(transfer, true))),
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
        transfers: await Promise.all(transfers.map(transfer => serializeTransfer(transfer))),
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
      data: await serializeTransfer(transfer, true)
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

const getTransferQr = async (req, res, next) => {
  try {
    const transfer = await Transfer.findOne({ transferId: req.params.id });
    if (!transfer) {
      return next(new AppError('Transfer not found', 'TRANSFER_NOT_FOUND', 404));
    }

    if (transfer.senderId.toString() !== req.user._id.toString()) {
      return next(new AppError('Forbidden', 'FORBIDDEN', 403));
    }

    const transferUrl = emailService.getTransferUrl(transfer, transfer.publicOrigin);
    const qrCodeUrl = await emailService.getQrCodeUrl(transferUrl);
    res.json({
      success: true,
      data: {
        transferId: transfer.transferId,
        transferUrl,
        qrCodeUrl
      }
    });
  } catch (error) {
    next(error);
  }
};

const resendEmail = async (req, res, next) => {
  try {
    const result = await transferService.resendEmail(req.params.id, req.user._id);
    res.json({
      success: true,
      data: {
        message: 'Email resend completed',
        emailResults: result.emailResults,
        recipients: serializeRecipients(result.transfer.recipients)
      }
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
  getTransferQr,
  deleteTransfer,
  revokeTransfer,
  resendEmail
};
