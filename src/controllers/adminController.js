const { pool } = require('../config/database');

async function getAllBooks(req, res) {
  try {
    const { rows } = await pool.query('SELECT * FROM books ORDER BY created_at DESC');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch books' });
  }
}

async function createBook(req, res) {
  const { title, author, description, price, stock, image_url, category } = req.body;
  if (!title || !author || !price) {
    return res.status(400).json({ error: 'title, author, and price are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO books (title, author, description, price, stock, image_url, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, author, description, price, stock || 0, image_url, category]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to create book' });
  }
}

async function updateBook(req, res) {
  const { title, author, description, price, stock, image_url, category } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE books SET
        title = COALESCE($1, title),
        author = COALESCE($2, author),
        description = COALESCE($3, description),
        price = COALESCE($4, price),
        stock = COALESCE($5, stock),
        image_url = COALESCE($6, image_url),
        category = COALESCE($7, category)
       WHERE id = $8 RETURNING *`,
      [title, author, description, price, stock, image_url, category, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Book not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to update book' });
  }
}

async function deleteBook(req, res) {
  try {
    const { rowCount } = await pool.query('DELETE FROM books WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Book not found' });
    res.json({ message: 'Book deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete book' });
  }
}

async function getAllOrders(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.total_amount, o.status, o.created_at,
              u.name AS customer_name, u.email AS customer_email
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

async function updateOrderStatus(req, res) {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to update order' });
  }
}

module.exports = { getAllBooks, createBook, updateBook, deleteBook, getAllOrders, updateOrderStatus };
