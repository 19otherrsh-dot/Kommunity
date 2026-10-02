const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate, requireMember } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// GET /api/communities/:communityId/analytics
// We use requireMember to ensure they belong to the community, 
// and the controller checks if they are the owner.
router.get('/', authenticate, requireMember, analyticsController.getDashboardStats);

module.exports = router;
