const fs = require('fs');
const path = require('path');
const Transfer = require('../models/Transfer');
const storageService = require('./storageService');
const logger = require('../utils/logger');

const runCleanup = async () => {
  try {
    const now = new Date();

    const expiredResult = await Transfer.updateMany(
      { expiresAt: { $lt: now }, status: 'active' },
      { $set: { status: 'expired' } }
    );

    if (expiredResult.modifiedCount > 0) {
      logger.info(`Cleanup worker: marked ${expiredResult.modifiedCount} transfers as expired`);
    }

    const expiredTransfers = await Transfer.find({ status: 'expired' }).lean();
    for (const transfer of expiredTransfers) {
      try {
        if (transfer.files && transfer.files.length > 0) {
          const keys = transfer.files.map(f => f.storageKey);
          await storageService.deleteFiles(keys);
        }
        await Transfer.deleteOne({ _id: transfer._id });
        logger.info(`Cleanup worker: deleted expired transfer ${transfer.transferId}`);
      } catch (error) {
        logger.error(`Cleanup worker: failed to delete transfer ${transfer.transferId}: ${error.message}`);
      }
    }

    if (storageService.getProvider() === 'local') {
      const multipartDir = path.join(__dirname, '..', '..', 'uploads', 'multipart');
      if (fs.existsSync(multipartDir)) {
        const entries = fs.readdirSync(multipartDir, { withFileTypes: true });
        const nowTime = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const dirPath = path.join(multipartDir, entry.name);
            const stats = fs.statSync(dirPath);
            if (nowTime - stats.mtimeMs > maxAge) {
              fs.rmSync(dirPath, { recursive: true, force: true });
              logger.info(`Cleanup worker: removed abandoned multipart upload ${entry.name}`);
            }
          }
        }
      }
    }

    logger.info('Cleanup worker completed successfully');
  } catch (error) {
    logger.error(`Cleanup worker error: ${error.message}`);
  }
};

const startCleanupWorker = () => {
  logger.info('Cleanup worker started');
  runCleanup();
  setInterval(runCleanup, 60 * 60 * 1000);
};

module.exports = { runCleanup, startCleanupWorker };
