const { pool } = require('../config/database');

async function listBooks(req, res) {
  const { q, category } = req.query;
  let query = 'SELECT * FROM books WHERE 1=1';
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    query += ` AND (title ILIKE $${params.length} OR author ILIKE $${params.length})`;
  }
  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }
  query += ' ORDER BY created_at DESC';

  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch books' });
  }
}

async function getBook(req, res) {
  try {
    const { rows } = await pool.query('SELECT * FROM books WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Book not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to fetch book' });
  }
}

module.exports = { listBooks, getBook };
