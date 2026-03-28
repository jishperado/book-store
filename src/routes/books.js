const router = require('express').Router();
const { listBooks, getBook } = require('../controllers/bookController');

router.get('/', listBooks);
router.get('/:id', getBook);

module.exports = router;
