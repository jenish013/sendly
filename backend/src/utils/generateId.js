const crypto = require('crypto');

const generateTransferId = () => {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
};

const generateFileId = () => {
  return crypto.randomBytes(8).toString('hex');
};

const generateUploadId = () => {
  return crypto.randomBytes(12).toString('hex');
};

module.exports = { generateTransferId, generateFileId, generateUploadId };
