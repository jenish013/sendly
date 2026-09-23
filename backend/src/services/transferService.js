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

const applyEmailResults = (transfer, emailResults) => {
  const resultsByEmail = new Map();
  for (const result of emailResults || []) {
    if (result?.email) {
      resultsByEmail.set(result.email.toLowerCase(), result);
    }
  }

  for (const recipient of transfer.recipients || []) {
    const result = resultsByEmail.get(recipient.email.toLowerCase());
    const attemptTime = new Date();

    recipient.lastEmailAttemptAt = attemptTime;

    if (!result) {
      recipient.emailStatus = 'failed';
      recipient.emailError = 'Email provider returned no result';
      recipient.emailProvider = null;
      recipient.emailMessageId = null;
      recipient.status = 'failed';
      continue;
    }

    recipient.emailProvider = result.provider || null;
    recipient.emailMessageId = result.messageId || null;

    if (result.success) {
      recipient.emailStatus = 'sent';
      recipient.emailError = null;
      recipient.notifiedAt = attemptTime;
      recipient.status = 'sent';
    } else {
      recipient.emailStatus = 'failed';
      recipient.emailError = result.error || result.reason || 'Email sending failed';
      recipient.status = 'failed';
    }
  }
};

const completeTransfer = async (transferId, files) => {
  const transfer = await Transfer.findOne({ transferId });
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  if (transfer.status !== 'uploading') {
    if (transfer.status === 'active') {
      return { transfer, emailResults: [], alreadyCompleted: true };
    }
    throw new Error('Transfer is not in uploading status');
  }

  transfer.files = files.map(f => ({
    fileId: f.fileId,
    originalName: f.originalName,
    storageKey: f.storageKey,
    mimeType: f.mimeType,
    size: f.size,
    checksum: f.checksum || null
  }));
  transfer.totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
  transfer.status = 'active';
  await transfer.save();

  let emailResults = [];
  try {
    emailResults = await emailService.sendTransferEmail(transfer, transfer.publicOrigin);
  } catch (emailError) {
    logger.error(`Transfer email failed for ${transferId}: ${emailError.message}`);
    emailResults = (transfer.recipients || []).map(recipient => ({
      email: recipient.email,
      success: false,
      error: emailError.message
    }));
  }

  applyEmailResults(transfer, emailResults);
  await transfer.save();

  logger.info(`Transfer completed: ${transferId}, emails sent: ${emailResults.filter(result => result?.success).length}`);
  return { transfer, emailResults };
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

  const recipient = transfer.recipients.find(r => r.email.toLowerCase() === String(recipientEmail || '').toLowerCase());
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

  const recipientsToNotify = (transfer.recipients || []).filter(recipient => recipient.emailStatus !== 'sent');
  const emailResults = recipientsToNotify.length > 0
    ? await emailService.sendTransferEmail(transfer, transfer.publicOrigin, {
        recipientEmails: recipientsToNotify.map(recipient => recipient.email)
      })
    : [];

  applyEmailResults(transfer, emailResults);
  await transfer.save();
  logger.info(`Email resend completed for transfer: ${transferId}`);
  return { transfer, emailResults };
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
