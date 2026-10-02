const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// POST /api/notifications/trigger-digest (Webhook/cron endpoint)
router.post('/trigger-digest', notificationController.triggerDigest);

router.use(authenticate);

// GET /api/notifications
router.get('/', notificationController.list);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', notificationController.markAsRead);

// POST /api/notifications/read-all
router.post('/read-all', notificationController.markAllAsRead);

module.exports = router;
