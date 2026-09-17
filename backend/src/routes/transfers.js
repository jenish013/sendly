const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const { transferLimiter } = require('../middleware/rateLimiter');
const { validateCreateTransfer } = require('../middleware/validate');
const auth = require('../middleware/auth');

router.use(auth);

router.post('/', transferLimiter, validateCreateTransfer, transferController.createTransfer);
router.post('/:id/complete', transferController.completeTransfer);
router.get('/sent', transferLimiter, transferController.getSentTransfers);
router.get('/received', transferLimiter, transferController.getReceivedTransfers);
router.get('/:id', transferController.getTransfer);
router.delete('/:id', transferController.deleteTransfer);
router.post('/:id/revoke', transferController.revokeTransfer);
router.post('/:id/resend-email', transferController.resendEmail);

module.exports = router;
