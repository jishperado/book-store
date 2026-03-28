const { pool } = require('../config/database');
const { buildPaymentPayload, savePaymentRecord } = require('../services/paymentService');

async function getCart(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT ci.id, ci.quantity, b.id AS book_id, b.title, b.author, b.price, b.image_url
       FROM cart_items ci
       JOIN books b ON b.id = ci.book_id
       WHERE ci.user_id = $1`,
      [req.user.id]
    );
    const total = rows.reduce((sum, item) => sum + item.price * item.quantity, 0);
    res.json({ items: rows, total: parseFloat(total).toFixed(2) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
}

async function addToCart(req, res) {
  const { book_id, quantity = 1 } = req.body;
  if (!book_id) return res.status(400).json({ error: 'book_id is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO cart_items (user_id, book_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, book_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
       RETURNING *`,
      [req.user.id, book_id, quantity]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to add to cart' });
  }
}

async function updateCart(req, res) {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) return res.status(400).json({ error: 'quantity must be >= 1' });
  try {
    const { rows } = await pool.query(
      'UPDATE cart_items SET quantity = $1 WHERE user_id = $2 AND book_id = $3 RETURNING *',
      [quantity, req.user.id, req.params.bookId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cart item not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to update cart' });
  }
}

async function removeFromCart(req, res) {
  try {
    await pool.query(
      'DELETE FROM cart_items WHERE user_id = $1 AND book_id = $2',
      [req.user.id, req.params.bookId]
    );
    res.json({ message: 'Removed from cart' });
  } catch {
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
}

// Initiates payment — creates order + payment record, returns OmniWare redirect payload
async function checkout(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: cartItems } = await client.query(
      `SELECT ci.quantity, b.id AS book_id, b.price, b.stock
       FROM cart_items ci JOIN books b ON b.id = ci.book_id
       WHERE ci.user_id = $1`,
      [req.user.id]
    );

    if (cartItems.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient stock for book ID ${item.book_id}` });
      }
    }

    const total = cartItems.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);

    // Create order with status 'pending' — confirmed after payment callback
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, 'pending') RETURNING id`,
      [req.user.id, total]
    );
    const orderId = orderRows[0].id;

    for (const item of cartItems) {
      await client.query(
        'INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [orderId, item.book_id, item.quantity, item.price]
      );
      // Reserve stock
      await client.query('UPDATE books SET stock = stock - $1 WHERE id = $2', [item.quantity, item.book_id]);
    }

    // Clear cart
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
    await client.query('COMMIT');

    // Get full user info for payment payload
    const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = userRows[0];

    // Create pending payment record
    const tnxId = `BS-${orderId}-${Date.now()}`;
    const paymentRecordId = await savePaymentRecord(req.user.id, orderId, total, tnxId);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const { payload, PAYMENT_URL } = buildPaymentPayload({
      user,
      orderId: tnxId,
      paymentRecordId,
      amount: total,
      returnUrl: `${baseUrl}/api/payment/callback`,
    });

    res.json({ payment_url: PAYMENT_URL, payload, order_id: orderId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Checkout failed' });
  } finally {
    client.release();
  }
}

module.exports = { getCart, addToCart, updateCart, removeFromCart, checkout };
