const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate, requireMember, requireAdmin } = require('../middleware/auth');
const spaceController = require('../controllers/spaceController');

// All routes scoped to /api/communities/:communityId/spaces

// GET /api/communities/:communityId/spaces — List all spaces
router.get('/', authenticate, requireMember, spaceController.listSpaces);

// GET /api/communities/:communityId/spaces/:spaceSlug — Get single space by slug
router.get('/:spaceSlug', authenticate, requireMember, spaceController.getSpace);

// POST /api/communities/:communityId/spaces — Create a new space (admin)
router.post('/', authenticate, requireAdmin, spaceController.createSpace);

// PATCH /api/communities/:communityId/spaces/:spaceId — Update space (admin)
router.patch('/:spaceId', authenticate, requireAdmin, spaceController.updateSpace);

// DELETE /api/communities/:communityId/spaces/:spaceId — Delete space (admin)
router.delete('/:spaceId', authenticate, requireAdmin, spaceController.deleteSpace);

// POST /api/communities/:communityId/spaces/reorder — Reorder spaces (admin)
router.post('/reorder', authenticate, requireAdmin, spaceController.reorderSpaces);

// ─── Group chat messages (chat-type spaces) ──────────────────────────────────
// GET  /api/communities/:communityId/spaces/:spaceId/messages
router.get('/:spaceId/messages', authenticate, requireMember, spaceController.listMessages);
// POST /api/communities/:communityId/spaces/:spaceId/messages
router.post('/:spaceId/messages', authenticate, requireMember, spaceController.postMessage);

module.exports = router;
