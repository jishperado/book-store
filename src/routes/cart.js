const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const { getCart, addToCart, updateCart, removeFromCart, checkout } = require('../controllers/cartController');

router.use(verifyToken);

router.get('/', getCart);
router.post('/', addToCart);
router.put('/:bookId', updateCart);
router.delete('/:bookId', removeFromCart);
router.post('/checkout', checkout);

module.exports = router;
