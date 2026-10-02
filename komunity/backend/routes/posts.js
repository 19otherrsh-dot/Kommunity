const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate, requireMember, requireModerator } = require('../middleware/auth');
const postController = require('../controllers/postController');

// All post routes are scoped to a community
// Base path: /api/communities/:communityId/posts (mounted in communities router)
// or: /api/posts/:communityId (mounted directly)

// GET /api/communities/:communityId/posts — List posts (paginated, chronological)
router.get('/', authenticate, requireMember, postController.list);

// POST /api/communities/:communityId/posts — Create a post
router.post('/', authenticate, requireMember, postController.create);

// GET /api/communities/:communityId/posts/:postId — Get a single post with comments
router.get('/:postId', authenticate, requireMember, postController.get);

// PATCH /api/communities/:communityId/posts/:postId — Edit post (own post only)
router.patch('/:postId', authenticate, requireMember, postController.update);

// DELETE /api/communities/:communityId/posts/:postId — Delete post (own or moderator)
router.delete('/:postId', authenticate, requireMember, postController.remove);

// POST /api/communities/:communityId/posts/:postId/like — Like/unlike a post
router.post('/:postId/like', authenticate, requireMember, postController.toggleLike);

// POST /api/communities/:communityId/posts/:postId/poll-vote — Vote on a poll
router.post('/:postId/poll-vote', authenticate, requireMember, postController.votePoll);

// POST /api/communities/:communityId/posts/:postId/pin — Pin post (moderator)
router.post('/:postId/pin', authenticate, requireModerator, postController.togglePin);
router.post('/:postId/summarize', authenticate, requireMember, postController.summarize);

// ─── Comments ─────────────────────────────────────────────────────────────────
// POST /api/communities/:communityId/posts/:postId/comments
router.post('/:postId/comments', authenticate, requireMember, postController.addComment);

// PATCH /api/communities/:communityId/posts/:postId/comments/:commentId
router.patch('/:postId/comments/:commentId', authenticate, requireMember, postController.updateComment);

// DELETE /api/communities/:communityId/posts/:postId/comments/:commentId
router.delete('/:postId/comments/:commentId', authenticate, requireMember, postController.deleteComment);

// POST /api/communities/:communityId/posts/:postId/comments/:commentId/like
router.post('/:postId/comments/:commentId/like', authenticate, requireMember, postController.toggleCommentLike);

module.exports = router;
