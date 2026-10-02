const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate, requireMember, requireAdmin } = require('../middleware/auth');
const gamificationController = require('../controllers/gamificationController');

// GET /api/communities/:communityId/leaderboard
router.get('/leaderboard', authenticate, requireMember, gamificationController.leaderboard);

// GET /api/communities/:communityId/point-rules
router.get('/point-rules', authenticate, requireMember, gamificationController.getPointRules);

// PATCH /api/communities/:communityId/point-rules — Update point rules (admin)
router.patch('/point-rules', authenticate, requireAdmin, gamificationController.updatePointRules);

// GET /api/communities/:communityId/badges
router.get('/badges', authenticate, requireMember, gamificationController.getBadges);

// POST /api/communities/:communityId/badges — Create badge (admin)
router.post('/badges', authenticate, requireAdmin, gamificationController.createBadge);

module.exports = router;
