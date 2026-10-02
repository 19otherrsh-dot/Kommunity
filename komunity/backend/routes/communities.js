const express = require('express');
const router = express.Router();
const { authenticate, requireMember, requireAdmin } = require('../middleware/auth');
const communityController = require('../controllers/communityController');

// ─── Public routes ────────────────────────────────────────────────────────────
// GET /api/communities — Discover public communities
router.get('/', communityController.list);

// GET /api/communities/domain/:domain — Get community by custom domain
router.get('/domain/:domain', communityController.getByDomain);

// GET /api/communities/:communityId — Get community details
router.get('/:communityId', communityController.get);

// ─── Authenticated routes ─────────────────────────────────────────────────────
// POST /api/communities — Create a new community
router.post('/', authenticate, communityController.create);

// POST /api/communities/:communityId/join — Join a community
router.post('/:communityId/join', authenticate, communityController.join);

// DELETE /api/communities/:communityId/leave — Leave a community
router.delete('/:communityId/leave', authenticate, requireMember, communityController.leave);

const tierController = require('../controllers/tierController');
const webhookController = require('../controllers/webhookController');
const affiliateController = require('../controllers/affiliateController');

// ─── Tiers (Public/Authenticated) ─────────────────────────────────────────────
// GET /api/communities/:communityId/tiers
router.get('/:communityId/tiers', tierController.listTiers);

// ─── Admin-only routes ────────────────────────────────────────────────────────
// PATCH /api/communities/:communityId — Update community settings
router.patch('/:communityId', authenticate, requireAdmin, communityController.update);

// DELETE /api/communities/:communityId — Delete a community
router.delete('/:communityId', authenticate, requireAdmin, communityController.remove);

// PATCH /api/communities/:communityId/members/:userId/role — Update member role
router.patch('/:communityId/members/:userId/role', authenticate, requireAdmin, communityController.updateMemberRole);

// DELETE /api/communities/:communityId/members/:userId — Remove member
router.delete('/:communityId/members/:userId', authenticate, requireAdmin, communityController.removeMember);

// GET /api/communities/:communityId/export-members — Export members CSV
router.get('/:communityId/export-members', authenticate, requireAdmin, communityController.exportMembers);

// GET /api/communities/:communityId/members/pending — List pending members
router.get('/:communityId/members/pending', authenticate, requireAdmin, communityController.listPendingMembers);

// PUT /api/communities/:communityId/members/:userId/status — Update member status
router.put('/:communityId/members/:userId/status', authenticate, requireAdmin, communityController.updateMemberStatus);

// POST /api/communities/:communityId/broadcast — Send custom email broadcast
router.post('/:communityId/broadcast', authenticate, requireAdmin, communityController.sendBroadcast);

// GET /api/communities/:communityId/analytics — Analytics dashboard
router.get('/:communityId/analytics', authenticate, requireAdmin, communityController.getAnalytics);

// ─── Admin-only Tiers ─────────────────────────────────────────────────────────
// POST /api/communities/:communityId/tiers
router.post('/:communityId/tiers', authenticate, requireAdmin, tierController.createTier);

// PUT /api/communities/:communityId/tiers/:tierId
router.put('/:communityId/tiers/:tierId', authenticate, requireAdmin, tierController.updateTier);

// DELETE /api/communities/:communityId/tiers/:tierId
router.delete('/:communityId/tiers/:tierId', authenticate, requireAdmin, tierController.deleteTier);

// ─── Webhooks ─────────────────────────────────────────────────────────────────
router.get('/:communityId/webhooks', authenticate, requireAdmin, webhookController.list);
router.get('/:communityId/webhooks/:webhookId/deliveries', authenticate, requireAdmin, webhookController.listDeliveries);
router.post('/:communityId/webhooks', authenticate, requireAdmin, webhookController.create);
router.put('/:communityId/webhooks/:webhookId', authenticate, requireAdmin, webhookController.update);
router.delete('/:communityId/webhooks/:webhookId', authenticate, requireAdmin, webhookController.remove);

// ─── Affiliates ───────────────────────────────────────────────────────────────
router.get('/:communityId/affiliates/config', authenticate, requireAdmin, affiliateController.getConfig);
router.put('/:communityId/affiliates/config', authenticate, requireAdmin, affiliateController.updateConfig);
router.get('/:communityId/affiliates/leaderboard', authenticate, requireAdmin, affiliateController.getLeaderboard);
router.get('/:communityId/affiliates/me', authenticate, requireMember, affiliateController.getMyStats);
router.get('/:communityId/affiliates/owed', authenticate, requireAdmin, affiliateController.getOwedCommissions);
router.post('/:communityId/affiliates/payout', authenticate, requireAdmin, affiliateController.markCommissionsPaid);

// ─── API Keys (public API / Zapier) ───────────────────────────────────────────
const apiKeyController = require('../controllers/apiKeyController');
router.get('/:communityId/api-keys', authenticate, requireAdmin, apiKeyController.listKeys);
router.post('/:communityId/api-keys', authenticate, requireAdmin, apiKeyController.createKey);
router.delete('/:communityId/api-keys/:keyId', authenticate, requireAdmin, apiKeyController.revokeKey);

module.exports = router;
