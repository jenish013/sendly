const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const { transferLimiter } = require('../middleware/rateLimiter');

router.get('/transfers/:transferId', transferLimiter, publicController.getPublicTransfer);
router.post('/transfers/:transferId/verify-password', transferLimiter, publicController.verifyPassword);
router.get('/transfers/:transferId/files/:fileId/download', transferLimiter, publicController.downloadFile);

module.exports = router;
