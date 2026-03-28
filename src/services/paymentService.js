const crypto = require('crypto');
const { pool } = require('../config/database');

const PAYMENT_URL = 'https://pgbiz.omniware.in/v2/paymentrequest';
const STATUS_URL  = 'https://pgbiz.omniware.in/v2/paymentstatus';

// Mirrors PaymentGate.php::hashCalculate
function hashCalculate(salt, input) {
  const hashColumns = [
    'address_line_1', 'address_line_2', 'amount', 'api_key', 'city',
    'country', 'currency', 'description', 'email', 'mode', 'name',
    'order_id', 'phone', 'return_url', 'state', 'split_enforce_strict',
    'split_info', 'udf1', 'udf2', 'udf3', 'udf4', 'udf5', 'zip_code',
  ].sort();

  let hashData = salt;
  for (const col of hashColumns) {
    if (input[col] && String(input[col]).length > 0) {
      hashData += '|' + String(input[col]).trim();
    }
  }
  return crypto.createHash('sha512').update(hashData).digest('hex').toUpperCase();
}

// Save initial pending payment record — mirrors PaymentGate.php::saveData
async function savePaymentRecord(customerId, orderId, amount, tnxId) {
  const { rows } = await pool.query(
    `INSERT INTO payment_status (customer_id, order_id, amount, tnx_id, sts, q_status)
     VALUES ($1, $2, $3, $4, 'P', 1) RETURNING id`,
    [customerId, orderId, amount, tnxId]
  );
  return rows[0].id;
}

// Build the POST fields to send to OmniWare — mirrors CartController.php checkout
function buildPaymentPayload({ user, orderId, paymentRecordId, amount, returnUrl }) {
  const apiKey = process.env.OMNIWARE_API_KEY;
  const salt   = process.env.OMNIWARE_SALT;
  const mode   = process.env.NODE_ENV === 'production' ? 'LIVE' : 'TEST';

  const payload = {
    api_key:    apiKey,
    order_id:   String(orderId),
    mode,
    name:       user.name,
    email:      user.email,
    phone:      user.phone || '0000000000',
    amount:     parseFloat(amount).toFixed(2),
    currency:   'INR',
    description: `BookStore Order #${orderId}`,
    return_url: returnUrl,
    udf2:       String(paymentRecordId), // used in callback to look up payment record
  };

  payload.hash = hashCalculate(salt, payload);
  return { payload, PAYMENT_URL };
}

// Update payment record from callback — mirrors PaymentGate.php::paymentSave
async function processCallback(post) {
  const paymentRecordId = post.udf2;
  const { rows } = await pool.query('SELECT * FROM payment_status WHERE id = $1', [paymentRecordId]);
  const record = rows[0];
  if (!record) throw new Error('Payment record not found');
  if (record.sts === 'S') return { alreadyProcessed: true, customerId: record.customer_id };

  // response_code 0 = success, 1000 = failed, others = pending
  const rc = parseInt(post.response_code);
  const sts       = rc === 0 ? 'S' : rc === 1000 ? 'F' : 'P';
  const q_status  = (rc === 0 || rc === 1000) ? 0 : 1;

  await pool.query(
    `UPDATE payment_status SET sts=$1, q_status=$2, response=$3, updated_at=NOW() WHERE id=$4`,
    [sts, q_status, JSON.stringify(post), paymentRecordId]
  );

  if (rc === 0) {
    // Mark order as confirmed and activate it
    await pool.query(
      `UPDATE orders SET status='confirmed' WHERE id=$1`,
      [record.order_id]
    );
  }

  return { alreadyProcessed: false, success: rc === 0, customerId: record.customer_id, orderId: record.order_id };
}

// Poll OmniWare for status of pending payments (for cron/background checks)
async function checkPendingPayments() {
  const { rows: pending } = await pool.query(
    `SELECT * FROM payment_status WHERE q_status=1 AND created_at < NOW() - INTERVAL '5 minutes'`
  );

  for (const payment of pending) {
    const data = {
      api_key:  process.env.OMNIWARE_API_KEY,
      order_id: payment.tnx_id,
    };
    data.hash = hashCalculate(process.env.OMNIWARE_SALT, data);

    try {
      const res = await fetch(STATUS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString(),
      });
      const result = await res.json();
      await processCallback({ ...result, udf2: String(payment.id) });
    } catch (err) {
      console.error(`Failed to check payment ${payment.id}:`, err.message);
    }
  }
}

module.exports = { buildPaymentPayload, savePaymentRecord, processCallback, checkPendingPayments };
