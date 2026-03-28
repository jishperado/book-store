const { processCallback, checkPendingPayments } = require('../services/paymentService');

// POST /api/payment/callback — OmniWare posts here after payment
async function callback(req, res) {
  try {
    const post = req.body;
    const result = await processCallback(post);

    if (result.alreadyProcessed) {
      return res.redirect('/?payment=already_processed');
    }

    if (result.success) {
      return res.redirect(`/order-success?order_id=${result.orderId}`);
    } else {
      return res.redirect(`/order-failed?order_id=${result.orderId}`);
    }
  } catch (err) {
    console.error('Payment callback error:', err.message);
    res.redirect('/?payment=error');
  }
}

// GET /api/payment/status/:paymentId — frontend can poll this
async function getStatus(req, res) {
  const { pool } = require('../config/database');
  try {
    const { rows } = await pool.query(
      'SELECT id, sts, amount, tnx_id, order_id, created_at FROM payment_status WHERE id=$1',
      [req.params.paymentId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const statusMap = { S: 'success', F: 'failed', P: 'pending' };
    res.json({ ...rows[0], status: statusMap[rows[0].sts] });
  } catch {
    res.status(500).json({ error: 'Failed to fetch payment status' });
  }
}

// POST /api/payment/check-pending — admin trigger to poll OmniWare for pending payments
async function triggerPendingCheck(req, res) {
  try {
    await checkPendingPayments();
    res.json({ message: 'Pending payment check completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { callback, getStatus, triggerPendingCheck };
