require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initSchema } = require('./config/database');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // needed for OmniWare callback (form POST)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/books',   require('./routes/books'));
app.use('/api/cart',    require('./routes/cart'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/payment', require('./routes/payment'));

// Serve HTML pages
app.get('/cart',          (req, res) => res.sendFile(path.join(__dirname, '../public/cart.html')));
app.get('/admin',         (req, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));
app.get('/order-success', (req, res) => res.sendFile(path.join(__dirname, '../public/order-success.html')));
app.get('/order-failed',  (req, res) => res.sendFile(path.join(__dirname, '../public/order-failed.html')));
app.get('*',              (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

// Start serving immediately; attempt DB init in background
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

initSchema()
  .then(() => console.log('Database connected and schema ready.'))
  .catch((err) => console.error('Database unavailable — API routes will fail until DB is connected:', err.message));
