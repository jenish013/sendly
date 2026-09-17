require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const { markExpiredTransfers, deleteExpiredTransferFiles } = require('./services/transferService');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    server.timeout = 10 * 60 * 1000;
    server.requestTimeout = 10 * 60 * 1000;
    server.headersTimeout = 10 * 60 * 1000;

    server.on('error', (error) => {
      logger.error(`Server error: ${error.message}`);
      process.exit(1);
    });

    const runCleanup = async () => {
      try {
        await markExpiredTransfers();
        await deleteExpiredTransferFiles();
      } catch (error) {
        logger.error(`Cleanup worker error: ${error.message}`);
      }
    };

    runCleanup();
    setInterval(runCleanup, 60 * 60 * 1000);
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
