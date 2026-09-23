const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const transferRoutes = require('./transfers');
const uploadRoutes = require('./uploads');
const publicRoutes = require('./public');

router.use('/auth', authRoutes);
router.use('/transfers', transferRoutes);
router.use('/uploads', uploadRoutes);
router.use('/public', publicRoutes);

module.exports = router;
