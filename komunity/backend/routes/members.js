const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate, requireMember } = require('../middleware/auth');
const memberController = require('../controllers/memberController');

// GET /api/communities/:communityId/members — Member directory
router.get('/', authenticate, requireMember, memberController.list);

// GET /api/communities/:communityId/members/:userId — Member profile
router.get('/:userId', authenticate, requireMember, memberController.get);

module.exports = router;
