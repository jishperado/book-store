const router = require('express').Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const {
  getAllBooks, createBook, updateBook, deleteBook,
  getAllOrders, updateOrderStatus
} = require('../controllers/adminController');

router.use(verifyToken, requireAdmin);

router.get('/books', getAllBooks);
router.post('/books', createBook);
router.put('/books/:id', updateBook);
router.delete('/books/:id', deleteBook);

router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);

module.exports = router;
