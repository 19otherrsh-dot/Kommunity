const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Webhook endpoints MUST receive raw unparsed bodies for signature verification.
// We apply express.raw() locally here.
const rawParser = express.raw({ type: 'application/json' });

router.post('/mux', rawParser, webhookController.muxWebhook);
router.post('/daily', rawParser, webhookController.dailyWebhook);

module.exports = router;
