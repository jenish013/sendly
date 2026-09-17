const Transfer = require('../models/Transfer');
const storageService = require('./storageService');
const emailService = require('./emailService');
const bcrypt = require('bcryptjs');
const { generateTransferId } = require('../utils/generateId');
const logger = require('../utils/logger');

const createTransfer = async (userId, data) => {
  const { recipients, files, message, passwordProtected, password, expiresIn, senderEmail, senderName, publicOrigin } = data;

  const transferId = generateTransferId();
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const transfer = new Transfer({
    transferId,
    senderId: userId,
    senderEmail: senderEmail || '',
    senderName: senderName || '',
    publicOrigin: publicOrigin || '',
    recipients: recipients.map(r => ({
      email: r.email,
      name: r.name || '',
      status: 'pending'
    })),
    files: files.map(f => ({
      fileId: f.fileId,
      originalName: f.originalName,
      storageKey: f.storageKey || `transfers/${transferId}/${f.fileId}`,
      mimeType: f.mimeType,
      size: f.size,
      checksum: f.checksum || null
    })),
    totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
    message: message || '',
    passwordProtected: passwordProtected || false,
    passwordHash: passwordProtected ? bcrypt.hashSync(password, 12) : null,
    expiresAt,
    status: 'uploading'
  });

  await transfer.save();
  logger.info(`Transfer created: ${transferId} by user ${userId}`);
  return transfer;
};

const completeTransfer = async (transferId, files) => {
  const transfer = await Transfer.findOne({ transferId });
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  if (transfer.status !== 'uploading') {
    throw new Error('Transfer is not in uploading status');
  }

  transfer.status = 'processing';
  transfer.files = files.map(f => ({
    fileId: f.fileId,
    originalName: f.originalName,
    storageKey: f.storageKey,
    mimeType: f.mimeType,
    size: f.size,
    checksum: f.checksum || null
  }));
  transfer.totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
  await transfer.save();

  try {
    let emailResults = []
    try {
      emailResults = await emailService.sendTransferEmail(transfer, transfer.publicOrigin)
    } catch (emailError) {
      logger.error(`Transfer email failed for ${transferId}: ${emailError.message}`)
    }

    transfer.recipients.forEach((recipient, index) => {
      const result = emailResults[index]
      if (result) {
        recipient.emailStatus = result.success ? 'sent' : 'failed'
        if (result.success) {
          recipient.notifiedAt = new Date()
          recipient.status = 'sent'
        }
      } else {
        recipient.emailStatus = 'failed'
      }
    })

    transfer.status = 'active'
    await transfer.save()
    logger.info(`Transfer completed: ${transferId}, emails sent: ${emailResults.filter(r => r && r.success).length}`)
    return transfer
  } catch (error) {
    transfer.status = 'failed'
    await transfer.save()
    logger.error(`Transfer completion failed: ${transferId}, error: ${error.message}`)
    throw error
  }
};

const getPublicTransfer = async (transferId) => {
  const transfer = await Transfer.findOne({ transferId, status: 'active' });
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  if (transfer.isExpired()) {
    throw new Error('Transfer expired');
  }

  return transfer.toPublicJSON();
};

const verifyPassword = async (transferId, password) => {
  const transfer = await Transfer.findOne({ transferId });
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  if (!transfer.passwordProtected) {
    return true;
  }

  const bcrypt = require('bcryptjs');
  const match = await bcrypt.compare(password, transfer.passwordHash);
  if (!match) {
    throw new Error('Invalid password');
  }

  return true;
};

const recordDownload = async (transferId, fileId, recipientEmail) => {
  const transfer = await Transfer.findOne({ transferId });
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  transfer.downloadCount += 1;

  const recipient = transfer.recipients.find(r => r.email === recipientEmail);
  if (recipient) {
    recipient.downloadedAt = new Date();
    recipient.status = 'delivered';
  }

  await transfer.save();
  return transfer;
};

const revokeTransfer = async (transferId, userId) => {
  const transfer = await Transfer.findOne({ transferId });
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  if (transfer.senderId.toString() !== userId.toString()) {
    throw new Error('Forbidden');
  }

  transfer.status = 'revoked';
  await transfer.save();

  if (transfer.files.length > 0) {
    const keys = transfer.files.map(f => f.storageKey);
    try {
      await storageService.deleteFiles(keys);
      logger.info(`Files deleted for revoked transfer: ${transferId}`);
    } catch (error) {
      logger.error(`Failed to delete files for transfer ${transferId}: ${error.message}`);
    }
  }

  logger.info(`Transfer revoked: ${transferId}`);
  return transfer;
};

const resendEmail = async (transferId, userId) => {
  const transfer = await Transfer.findOne({ transferId });
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  if (transfer.senderId.toString() !== userId.toString()) {
    throw new Error('Forbidden');
  }

  if (transfer.status !== 'active') {
    throw new Error('Transfer is not active');
  }

  const results = await emailService.sendTransferEmail(transfer, transfer.publicOrigin);
  
  transfer.recipients.forEach((recipient, index) => {
    const result = results[index];
    if (result) {
      recipient.emailStatus = result.success ? 'sent' : 'failed';
      if (result.success) {
        recipient.notifiedAt = new Date();
      }
    }
  });

  await transfer.save();
  logger.info(`Email resent for transfer: ${transferId}`);
  return transfer;
};

const markExpiredTransfers = async () => {
  const now = new Date();
  const result = await Transfer.updateMany(
    { expiresAt: { $lt: now }, status: 'active' },
    { $set: { status: 'expired' } }
  );
  if (result.modifiedCount > 0) {
    logger.info(`Marked ${result.modifiedCount} transfers as expired`);
  }
  return result.modifiedCount;
};

const deleteExpiredTransferFiles = async () => {
  const expiredTransfers = await Transfer.find({ status: 'expired' });
  for (const transfer of expiredTransfers) {
    try {
      const keys = transfer.files.map(f => f.storageKey);
      if (keys.length > 0) {
        await storageService.deleteFiles(keys);
      }
      await Transfer.deleteOne({ _id: transfer._id });
      logger.info(`Deleted expired transfer files: ${transfer.transferId}`);
    } catch (error) {
      logger.error(`Failed to delete expired transfer ${transfer.transferId}: ${error.message}`);
    }
  }
};

module.exports = {
  createTransfer,
  completeTransfer,
  getPublicTransfer,
  verifyPassword,
  recordDownload,
  revokeTransfer,
  resendEmail,
  markExpiredTransfers,
  deleteExpiredTransferFiles
};
