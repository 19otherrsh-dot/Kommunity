const express = require('express');
const router = express.Router();
const unsubscribeController = require('../controllers/unsubscribeController');

// Public (no auth) — links live inside emails and must work without login.
router.get('/', unsubscribeController.unsubscribe);
router.post('/', unsubscribeController.oneClickUnsubscribe);

module.exports = router;
