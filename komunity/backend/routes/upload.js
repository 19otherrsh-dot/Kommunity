const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');

// POST /api/upload/presigned-url
router.post('/presigned-url', authenticate, uploadController.getPresignedUrl);

// POST /api/upload/mux-upload-url
router.post('/mux-upload-url', authenticate, uploadController.getMuxUploadUrl);

// GET /api/upload/mux-upload/:uploadId
router.get('/mux-upload/:uploadId', authenticate, uploadController.getMuxUploadStatus);

module.exports = router;
