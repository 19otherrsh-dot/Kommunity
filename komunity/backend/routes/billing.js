const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const billingController = require('../controllers/billingController');

// POST /api/billing/checkout — Create Stripe checkout session for community subscription
router.post('/checkout', authenticate, billingController.createCheckout);

// POST /api/billing/course-checkout — Create Stripe checkout session for one-off course purchase
router.post('/course-checkout', authenticate, billingController.createCourseCheckout);

// POST /api/billing/product-checkout — Create Stripe checkout for a one-off digital product
router.post('/product-checkout', authenticate, billingController.createProductCheckout);

// POST /api/billing/portal — Customer portal for managing subscription
router.post('/portal', authenticate, billingController.createPortalSession);

// POST /api/billing/connect/onboard — Start/resume Stripe Connect payout setup (owner only)
router.post('/connect/onboard', authenticate, billingController.createConnectOnboarding);

// GET /api/billing/connect/:communityId/status — Connect payout readiness (owner only)
router.get('/connect/:communityId/status', authenticate, billingController.getConnectStatus);

// Affiliate (user) payout onboarding + status
router.post('/connect/affiliate/onboard', authenticate, billingController.createAffiliateOnboarding);
router.get('/connect/affiliate/status', authenticate, billingController.getAffiliateConnectStatus);

// Webhook is now mounted in server.js directly to preserve raw body

// GET /api/billing/subscriptions — My active subscriptions
router.get('/subscriptions', authenticate, billingController.mySubscriptions);

// GET /api/billing/creator-dashboard — Creator earnings (community owner only)
router.get('/creator-dashboard', authenticate, billingController.creatorDashboard);

module.exports = router;
