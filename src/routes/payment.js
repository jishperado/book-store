const router = require('express').Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { callback, getStatus, triggerPendingCheck } = require('../controllers/paymentController');

// OmniWare posts form data here after payment — no auth (it's a gateway callback)
router.post('/callback', callback);

// Frontend polls payment status
router.get('/status/:paymentId', verifyToken, getStatus);

// Admin: manually trigger pending payment status check
router.post('/check-pending', verifyToken, requireAdmin, triggerPendingCheck);

module.exports = router;
