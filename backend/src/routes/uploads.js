const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { uploadPart, validateFileUpload } = require('../middleware/upload');
const auth = require('../middleware/auth');

router.use(auth);

router.post('/multipart', uploadLimiter, uploadController.createMultipartUpload);
router.post('/:uploadId/part', uploadLimiter, uploadPart, validateFileUpload, uploadController.uploadPart);
router.post('/:uploadId/complete', uploadLimiter, uploadController.completeMultipartUpload);
router.delete('/:uploadId', uploadLimiter, uploadController.abortMultipartUpload);

module.exports = router;
