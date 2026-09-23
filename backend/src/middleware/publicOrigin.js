const logger = require('../utils/logger');
const { validatePublicOrigin } = require('../services/emailService');

const getForwardedValue = (value) => String(value || '').split(',')[0].trim();

const attachPublicOrigin = (req, res, next) => {
  try {
    const forwardedProto = getForwardedValue(req.headers['x-forwarded-proto']);
    const forwardedHost = getForwardedValue(req.headers['x-forwarded-host']);
    let publicOrigin = forwardedProto && forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : '';

    if (!publicOrigin && req.headers.referer) {
      try {
        publicOrigin = new URL(req.headers.referer).origin;
      } catch {
        publicOrigin = '';
      }
    }

    if (!publicOrigin && req.headers.host) {
      const protocol = forwardedProto || (req.secure ? 'https' : 'http');
      publicOrigin = `${protocol}://${req.headers.host}`;
    }

    const validation = validatePublicOrigin(publicOrigin);
    if (validation?.valid || (validation?.isLocalhost && process.env.NODE_ENV !== 'production')) {
      req.publicOrigin = validation.origin;
    }
  } catch (error) {
    logger.warn(`Could not detect request public origin: ${error.message}`);
  }

  next();
};

module.exports = { attachPublicOrigin };