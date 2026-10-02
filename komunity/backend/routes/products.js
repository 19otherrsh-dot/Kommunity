const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate, requireMember, requireAdmin } = require('../middleware/auth');
const productController = require('../controllers/productController');

// All routes scoped to /api/communities/:communityId/products

// Members: browse the store + download purchased/free items
router.get('/', authenticate, requireMember, productController.listProducts);
router.get('/:productId/download', authenticate, requireMember, productController.getDownload);

// Admins: manage products (includes drafts)
router.get('/manage', authenticate, requireAdmin, productController.listAllProducts);
router.post('/', authenticate, requireAdmin, productController.createProduct);
router.patch('/:productId', authenticate, requireAdmin, productController.updateProduct);
router.delete('/:productId', authenticate, requireAdmin, productController.deleteProduct);

module.exports = router;
